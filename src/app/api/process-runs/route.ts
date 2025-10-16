// POST Start a new production run

import {NextRequest, NextResponse} from "next/server";
import prisma from "@/lib/db";
import {ProcessRun} from "@prisma/client";

type Body = {
	productVariantId: number;
	processTemplateId: number;
	batchCode: string;
	plannedQty?: string | number;
	plannedUnitId?: number;
	createdByWorkerId?: number;
	notes?: string;
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

export async function POST(request: NextRequest) {
	let body: Body;
	try {
		body = await request.json();
	} catch (err) {
		return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { productVariantId, processTemplateId, batchCode, plannedQty, plannedUnitId, createdByWorkerId, notes } = body;

	// Basic validation
	if (!productVariantId || !processTemplateId || !batchCode) {
		return NextResponse.json({ error: 'productVariantId, processTemplateId and batchCode are required' }, { status: 400 });
	}

	// Ensure batchCode is unique (Prisma will also enforce unique constraint)
	const existing = await prisma.processRun.findUnique({ where: { batchCode } });
	if (existing) {
		return NextResponse.json({ error: 'batchCode already exists' }, { status: 409 });
	}

	try {
		const createData: any = {
			productVariantId,
			processTemplateId,
			batchCode,
			notes: notes ?? null,
		};

		if (plannedQty !== undefined) {
			// store as string to feed Prisma Decimal
			createData.plannedQty = typeof plannedQty === 'number' ? plannedQty.toString() : plannedQty;
		}
		if (plannedUnitId) createData.plannedUnitId = plannedUnitId;
		if (createdByWorkerId) createData.createdByWorkerId = createdByWorkerId;

		const run = await prisma.processRun.create({
			data: createData,
			include: {
				productVariant: { select: { id: true, name: true } },
				processTemplate: { select: { id: true, name: true, version: true } },
				creator: { select: { id: true, fullName: true } },
				plannedUnit: { select: { id: true, name: true } },
				outputUnit: { select: { id: true, name: true } },
			}
		});

		return NextResponse.json(serialize(run), { status: 201 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
	}
}

