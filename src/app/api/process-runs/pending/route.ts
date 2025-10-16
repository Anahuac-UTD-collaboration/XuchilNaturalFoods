// GET List active production runs

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
	try {
		// Active statuses: PLANNED, IN_PROGRESS, PAUSED
		const runs = await prisma.processRun.findMany({
			where: { status: { in: ["PLANNED", "IN_PROGRESS", "PAUSED"] } },
			select: { id: true }
		});
		const ids = runs.map((r: { id: number }) => r.id);
		return NextResponse.json(ids, { status: 200 });
	} catch (err: any) {
		return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
	}
}