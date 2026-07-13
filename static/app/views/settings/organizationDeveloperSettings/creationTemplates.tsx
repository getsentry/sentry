import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

/**
 * A curated creation flow on the internal integration page, selected with
 * the `?template=<slug>` query param.
 *
 * Each template is its own creation form; this registry carries the display
 * metadata for the new-integration modal cards and the template header.
 */
export interface SentryAppTemplate {
  description: string;
  heading: string;
  slug: string;
}

const SENTRY_APP_TEMPLATES: SentryAppTemplate[] = [
  {
    slug: 'claude-routine',
    heading: t('Trigger a Claude routine'),
    description: t(
      'New issues will fire your Claude routine with a short plain-text prompt linking to the issue.'
    ),
  },
];

export function getSentryAppTemplates(organization: Organization): SentryAppTemplate[] {
  if (!organization.features.includes('sentry-apps-creation-templates')) {
    return [];
  }
  return SENTRY_APP_TEMPLATES;
}
