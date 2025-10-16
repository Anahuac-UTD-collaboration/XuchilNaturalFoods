import prisma from "@/lib/db";
import { NextResponse } from "next/server";
import { StepStatus } from "@prisma/client";

export async function POST(req: Request, { params }: { params: { stepId: string, action: string } }) {
  const { stepId, action } = params;
  const stepExecutionId = parseInt(stepId, 10);
  if (isNaN(stepExecutionId)) {
    return NextResponse.json({ error: "Invalid step ID" }, { status: 400 });
  }

  const now = new Date();

  try {
    const stepExecution = await prisma.stepExecution.findUnique({ where: { id: stepExecutionId } });
    if (!stepExecution) {
      return NextResponse.json({ error: "StepExecution not found" }, { status: 404 });
    }

    switch (action) {
      case "start":
        if (stepExecution.status !== StepStatus.PENDING) {
          return NextResponse.json({ error: "Step cannot be started" }, { status: 400 });
        }
        await prisma.stepExecution.update({
          where: { id: stepExecutionId },
          data: { status: StepStatus.IN_PROGRESS, startedAt: now },
        });
        return NextResponse.json({ message: `Step ${stepId} started` });

      case "pause":
        if (stepExecution.status !== StepStatus.IN_PROGRESS) {
          return NextResponse.json({ error: "Step cannot be paused" }, { status: 400 });
        }
        await prisma.stepExecution.update({
          where: { id: stepExecutionId },
          data: { status: StepStatus.BLOCKED }, // Use BLOCKED to represent paused state
        });
        await prisma.processPause.create({
          data: { processRunId: stepExecution.processRunId, startedAt: now },
        });
        return NextResponse.json({ message: `Step ${stepId} paused` });

      case "resume":
        if (stepExecution.status !== StepStatus.BLOCKED) { // Check for BLOCKED instead of PAUSED
          return NextResponse.json({ error: "Step cannot be resumed" }, { status: 400 });
        }
        await prisma.stepExecution.update({
          where: { id: stepExecutionId },
          data: { status: StepStatus.IN_PROGRESS },
        });
        await prisma.processPause.updateMany({
          where: { processRunId: stepExecution.processRunId, endedAt: null },
          data: { endedAt: now },
        });
        return NextResponse.json({ message: `Step ${stepId} resumed` });

      case "finish":
        if (stepExecution.status !== StepStatus.IN_PROGRESS && stepExecution.status !== StepStatus.BLOCKED) { // Check for BLOCKED instead of PAUSED
          return NextResponse.json({ error: "Step cannot be finished" }, { status: 400 });
        }
        await prisma.stepExecution.update({
          where: { id: stepExecutionId },
          data: { status: StepStatus.DONE, finishedAt: now },
        });
        return NextResponse.json({ message: `Step ${stepId} finished` });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "An error occurred" }, { status: 500 });
  }
}
