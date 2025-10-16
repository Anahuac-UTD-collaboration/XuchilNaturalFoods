//POST Finalize the run and trigger inventory logic

import { NextRequest, NextResponse } from "next/server";
import prisma  from "@/lib/db";

type Body = {
	goodOutputQty?: string | number;
	scrapQty?: string | number;
	outputUnitId?: number;
	lotCode?: string;
}

function serialize(obj: any): any {
	if (obj === null || obj === undefined) return obj;
	if (Array.isArray(obj)) return obj.map(serialize);
	if (typeof obj === 'object') {
		const out: any = {};
		for (const [k, v] of Object.entries(obj)) {
			if (v && typeof v === 'object' && typeof v.toString === 'function' && v.constructor && v.constructor.name === 'Decimal') {
				out[k] = v.toString();
				continue;
			}
			if (v instanceof Date) {
				out[k] = v.toISOString();
				continue;
			}
			out[k] = serialize(v);
		}
		return out;
	}
	return obj;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	const runId = parseInt((await params).id, 10);
	if (Number.isNaN(runId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

	let body: Body;
	try {
		body = await request.json();
	} catch (err) {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { goodOutputQty, scrapQty, outputUnitId, lotCode } = body;

	try {
		const run = await prisma.processRun.findUnique({ where: { id: runId } });
		if (!run) return NextResponse.json({ error: 'ProcessRun not found' }, { status: 404 });

		if (run.status === 'COMPLETED' || run.status === 'CANCELLED') {
			return NextResponse.json({ error: 'ProcessRun already finalized' }, { status: 400 });
		}

		const now = new Date();

		// Close any open pauses
		await prisma.processPause.updateMany({ where: { processRunId: runId, endedAt: null }, data: { endedAt: now } });

		// Determine output unit
		const finalUnitId = outputUnitId ?? run.outputUnitId ?? null;

		// Create or find inventory item for the productVariant
		const productVariantId = run.productVariantId;
		let inventoryItem = await prisma.inventoryItem.findFirst({ where: { productVariantId } });
		if (!inventoryItem) {
			inventoryItem = await prisma.inventoryItem.create({ data: { itemType: 'PRODUCT', productVariantId, defaultUnitId: finalUnitId ?? undefined } });
		}

		let inventoryLot: any = null;
		if (goodOutputQty !== undefined && goodOutputQty !== null && Number(goodOutputQty) > 0) {
			// create a lot for the produced output
			inventoryLot = await prisma.inventoryLot.create({
				data: {
					inventoryItemId: inventoryItem.id,
					lotCode: lotCode ?? run.batchCode,
					qtyOnHand: typeof goodOutputQty === 'number' ? goodOutputQty.toString() : goodOutputQty,
					unitId: finalUnitId ?? undefined,
					receivedAt: now,
				}
			});

			// Create inventory movement IN for the lot
			const movementUnitId = finalUnitId ?? inventoryItem.defaultUnitId ?? run.plannedUnitId;
			if (!movementUnitId) throw new Error('No unitId available for inventory movement. Provide outputUnitId or ensure inventory item or run has a default/planned unit.');

			await prisma.inventoryMovement.create({
				data: {
					inventoryLotId: inventoryLot.id,
					direction: 'IN',
					qty: typeof goodOutputQty === 'number' ? goodOutputQty.toString() : goodOutputQty ?? '0',
					unitId: movementUnitId,
					reason: 'COMPLETION_RUN',
					relatedProcessRunId: runId,
					movedAt: now,
					note: 'Completion - produced output'
				}
			});
		}

		// Update the processRun with final quantities and status
		const updated = await prisma.processRun.update({
			where: { id: runId },
			data: {
				status: 'COMPLETED',
				finishedAt: now,
				goodOutputQty: goodOutputQty !== undefined && goodOutputQty !== null ? (typeof goodOutputQty === 'number' ? goodOutputQty.toString() : goodOutputQty) : run.goodOutputQty,
				scrapQty: scrapQty !== undefined && scrapQty !== null ? (typeof scrapQty === 'number' ? scrapQty.toString() : scrapQty) : run.scrapQty,
				outputUnitId: finalUnitId ?? run.outputUnitId
			},
			include: {
				productVariant: { select: { id: true, name: true } },
				processTemplate: { select: { id: true, name: true } },
				creator: { select: { id: true, fullName: true } },
				processPauses: true
			}
		});

		return NextResponse.json(serialize({ updated, inventoryLot }), { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
	}
}