import type {ReactNode} from 'react';

import {t} from 'sentry/locale';
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

const CLAUDE_ROUTINE_STARTER_PROMPT = `Triage the Sentry issue passed in this run's context. The message includes
links to the issue and the event payload.

1. Review the issue: the error message, stack trace, how many users and
   events are affected, and whether it is new or a regression.
2. Decide what should happen:
   - Needs a human: crashes in core flows, regressions, errors spiking
     across many users, or anything that looks security-related.
   - Safe to archive: known noise, such as third-party script errors, bot
     traffic, or one-off network blips.
3. Act on the decision:
   - If it needs a human, notify the team with a short summary: what broke,
     who is affected, and a link to the issue.
   - If it is safe to archive, archive the issue in Sentry and note why.`;

const SENTRY_APP_TEMPLATES: SentryAppTemplate[] = [
  {
    slug: 'claude-routine',
    heading: t('Trigger a Claude routine'),
    description: t('New issues will fire your Claude routine through this integration.'),
    requiresFeatures: ['sentry-apps-custom-webhook-headers'],
    hiddenFields: ['allowedOrigins', 'isAlertable', 'overview', 'schema'],
    starterPrompt: CLAUDE_ROUTINE_STARTER_PROMPT,
    webhookUrlField: {
      label: t('Anthropic Routine URL'),
      hint: t('The fire URL from the API trigger settings of the routine.'),
      placeholder: 'https://api.anthropic.com/v1/claude_code/routines/trig_.../fire',
      required: true,
    },
    tokenField: {
      label: t('Routine Token'),
      hint: t('Shown once when the API trigger is added to the routine.'),
      placeholder: 'sk-ant-oat01-...',
      buildHeader: token => `Authorization: Bearer ${token}`,
    },
    prefill: {
      name: 'Claude Routine',
      overview: 'Fires a Claude routine when new issues are created.',
      webhookHeaders: [
        'anthropic-version: 2023-06-01',
        'anthropic-beta: experimental-cc-routine-2026-04-01',
      ],
      scopes: ['event:read'],
      events: ['issue.created'],
    },
  },
];

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
