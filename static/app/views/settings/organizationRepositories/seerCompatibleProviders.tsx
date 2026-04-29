const SEER_COMPATIBLE_PROVIDERS = new Set(['github', 'gitlab']);

export function isSeerCompatibleProvider(key: string): boolean {
  return SEER_COMPATIBLE_PROVIDERS.has(key);
}
