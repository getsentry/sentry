import type {DetectedPlatform} from 'sentry/views/onboarding/components/useScmPlatformDetection';

export function DetectedPlatformFixture(
  params: Partial<DetectedPlatform> = {}
): DetectedPlatform {
  return {
    platform: 'javascript-nextjs',
    language: 'JavaScript',
    bytes: 50000,
    confidence: 'high',
    priority: 1,
    ...params,
  };
}
