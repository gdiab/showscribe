// In production, this would use a proper database or Redis
const queueStatus = new Map<string, {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  createdAt: number;
}>();

export function updateJobStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed', result?: unknown, error?: string) {
  const job = queueStatus.get(id);
  if (job) {
    job.status = status;
    job.result = result;
    job.error = error;
    queueStatus.set(id, job);
  }
}

export function createJob(id: string) {
  queueStatus.set(id, {
    id,
    status: 'pending',
    createdAt: Date.now(),
  });
}

export function getJob(id: string) {
  return queueStatus.get(id);
}