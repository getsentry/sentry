import type {ReactNode} from 'react';

import type {Scope} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {WebhookSubscription} from 'sentry/views/settings/organizationDeveloperSettings/constants';

/**
 * A starter configuration for the internal integration creation page,
 * selected with the `?template=<slug>` query param. Prefills seed the form's
 * initial values; the user can still edit everything before saving.
 */
export interface SentryAppTemplate {
  description: ReactNode;
  heading: string;
  prefill: {
    events?: WebhookSubscription[];
    isAlertable?: boolean;
    name?: string;
    overview?: string;
    schema?: Record<string, unknown>;
    /** Must cover the permissions the prefilled events require. */
    scopes?: Scope[];
    /** Only applied when the org can see the webhook headers field. */
    webhookHeaders?: string[];
    webhookUrl?: string;
  };
  slug: string;
  /** Form fields the template hides; their prefilled or default values still submit. */
  hiddenFields?: SentryAppTemplateHiddenField[];
  /** Org features required for the template to apply. */
  requiresFeatures?: string[];
  /** Copyable starter prompt for the service backing the integration. */
  starterPrompt?: string;
  /**
   * Replaces the raw webhook headers textarea with a single secret input.
   * The submitted headers are buildHeader(value) plus the prefilled headers.
   */
  tokenField?: {
    buildHeader: (value: string) => string;
    label: string;
    hint?: string;
    placeholder?: string;
  };
  /** Presentation overrides for the webhook URL field. */
  webhookUrlField?: {
    hint?: string;
    label?: string;
    placeholder?: string;
    required?: boolean;
  };
}

type SentryAppTemplateHiddenField =
  | 'allowedOrigins'
  | 'isAlertable'
  | 'overview'
  | 'schema';

const SENTRY_APP_TEMPLATES: SentryAppTemplate[] = [];

/** The templates the organization can start from. */
export function getSentryAppTemplates(organization: Organization): SentryAppTemplate[] {
  if (!organization.features.includes('sentry-apps-creation-templates')) {
    return [];
  }
  return SENTRY_APP_TEMPLATES.filter(
    template =>
      !template.requiresFeatures?.some(
        feature => !organization.features.includes(feature)
      )
  );
}

export function getSentryAppTemplate(
  slug: string | undefined,
  organization: Organization
): SentryAppTemplate | undefined {
  return getSentryAppTemplates(organization).find(entry => entry.slug === slug);
}
