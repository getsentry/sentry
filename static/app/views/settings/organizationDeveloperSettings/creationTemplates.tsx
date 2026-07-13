import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {WebhookSubscription} from 'sentry/views/settings/organizationDeveloperSettings/constants';

/**
 * A starter configuration for the internal integration creation page,
 * selected with the `?template=<slug>` query param.
 *
 * Adding a template means adding an entry here: the creation page renders a
 * fixed set of controls (name, webhook URL, permissions) from this data.
 */
export interface SentryAppTemplate {
  description: string;
  heading: string;
  prefill: {
    events?: WebhookSubscription[];
    name?: string;
    /** Must cover the permissions the prefilled events require. */
    scopes?: Scope[];
    webhookHeaders?: string[];
  };
  slug: string;
  webhookUrlField?: {
    hint?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
  };
}

const SENTRY_APP_TEMPLATES: SentryAppTemplate[] = [];

export function getSentryAppTemplates(organization: Organization): SentryAppTemplate[] {
  if (!organization.features.includes('sentry-apps-creation-templates')) {
    return [];
  }
  return SENTRY_APP_TEMPLATES;
}

export function getSentryAppTemplate(
  slug: string | undefined,
  organization: Organization
): SentryAppTemplate | undefined {
  return getSentryAppTemplates(organization).find(entry => entry.slug === slug);
}
