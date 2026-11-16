export function isTitleGenerationActive(status: string | null | undefined) {
  return status === 'pending' || status === 'running';
}
