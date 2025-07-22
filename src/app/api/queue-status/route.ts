import { NextRequest, NextResponse } from 'next/server';

// In production, this would use a proper database or Redis
const queueStatus = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: number;
}>();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Queue ID required' }, { status: 400 });
  }

  const job = queueStatus.get(id);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
  });
}

// Internal function to update job status
export function updateJobStatus(id: string, status: string, result?: any, error?: string) {
  const job = queueStatus.get(id);
  if (job) {
    job.status = status as any;
    job.result = result;
    job.error = error;
    queueStatus.set(id, job);
  }
}

// Internal function to create job
export function createJob(id: string) {
  queueStatus.set(id, {
    id,
    status: 'pending',
    createdAt: Date.now(),
  });
}