import type {AnyCardRenderer} from 'sentry/types/missionControl';

import ChangelogCardRenderer from './cards/changelogCard';
import IssueCardRenderer from './cards/issueCard';
import MissingInstrumentationCardRenderer from './cards/missingInstrumentationCard';
import UltragroupCardRenderer from './cards/ultragroupCard';
import WelcomeCardRenderer from './cards/welcomeCard';

/**
 * Map of card type strings to their renderer components.
 *
 * To add a new card type:
 * 1. Create a new renderer component that implements CardRenderer<YourDataType>
 * 2. Add it to this map with the card type string as the key
 * 3. Update the KnownCardTypes union in types/missionControl.tsx
 */
export const CARD_RENDERERS: Record<string, AnyCardRenderer> = {
  welcome: WelcomeCardRenderer,
  changelog: ChangelogCardRenderer,
  issue: IssueCardRenderer,
  'missing-instrumentation': MissingInstrumentationCardRenderer,
  ultragroup: UltragroupCardRenderer,
  // Add new card types here...
};

/**
 * Get the renderer component for a given card type.
 * Returns undefined if the card type is not recognized.
 */
export function getCardRenderer(cardType: string): AnyCardRenderer | undefined {
  return CARD_RENDERERS[cardType];
}

/**
 * Check if a card type has a registered renderer.
 */
export function hasCardRenderer(cardType: string): boolean {
  return cardType in CARD_RENDERERS;
}

/**
 * Get all supported card types.
 */
export function getSupportedCardTypes(): string[] {
  return Object.keys(CARD_RENDERERS);
}
