import { NextRequest, NextResponse } from 'next/server';
import { getJob } from '@/lib/queue';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Queue ID required' }, { status: 400 });
  }

  const job = getJob(id);
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