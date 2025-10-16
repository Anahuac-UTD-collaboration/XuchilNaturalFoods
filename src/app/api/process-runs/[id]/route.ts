//GET Detailed status of a run

import {NextRequest, NextResponse} from "next/server";
import prisma from '@/lib/db';
import {ProcessRun} from "@prisma/client";

export async function GET(request: NextRequest, {params}: { params: Promise<{ id: string }> }) {
	const rawId = (await params).id;

	// decide whether the param is numeric id or batchCode (non-numeric)
	const numericId = Number(rawId);
	const whereClause = Number.isFinite(numericId) && !Number.isNaN(numericId)
		? { id: numericId }
		: { batchCode: rawId };

	try {
		const processRun = await prisma.processRun.findUnique({
			where: whereClause as any,
			include: {
				productVariant: { select: { id: true, name: true } },
				processTemplate: { select: { id: true, name: true, version: true } },
				creator: { select: { id: true, fullName: true } },
				plannedUnit: { select: { id: true, name: true } },
				outputUnit: { select: { id: true, name: true } },
				processPauses: { orderBy: { startedAt: 'asc' } },
				stepExecutions: {
					include: {
						templateStep: { select: { id: true, name: true, position: true } },
						worker: { select: { id: true, fullName: true } }
					},
					orderBy: { id: 'asc' }
				},
				inventoryMovements: { orderBy: { movedAt: 'asc' } }
			}
		});

		if (!processRun) {
			return NextResponse.json({ error: 'ProcessRun not found' }, { status: 404 });
		}

		// Serialize Decimal and Date fields to JSON-friendly primitives
		function serialize(obj: any): any {
			if (obj === null || obj === undefined) return obj;
			if (Array.isArray(obj)) return obj.map(serialize);
			if (typeof obj === 'object') {
				const out: any = {};
				for (const [k, v] of Object.entries(obj)) {
					// Decimal.js instances from Prisma have toString()
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

		const payload = serialize(processRun);

		return NextResponse.json(payload, { status: 200 });
	} catch (err: any) {
		// Log server-side if you have a logger (here we just return error info)
		return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
	}

}
