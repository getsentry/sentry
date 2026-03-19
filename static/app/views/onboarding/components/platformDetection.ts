import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {platformProductAvailability} from 'sentry/components/onboarding/productSelection';
import type {PlatformKey} from 'sentry/types/project';

export type DetectedPlatform = {
  bytes: number;
  confidence: string;
  language: string;
  platform: PlatformKey;
  priority: number;
};

export function getAvailableFeaturesForPlatform(
  platformKey: PlatformKey
): ProductSolution[] {
  return platformProductAvailability[platformKey] ?? [];
}
