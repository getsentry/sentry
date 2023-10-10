export function shouldRetryHandler(failureCount: number, error: Error) {
  return failureCount < 3 && error.message.includes('429');
}

export function getRetryDelay(attempt: number) {
  return 1000 * Math.pow(3, attempt);
}
