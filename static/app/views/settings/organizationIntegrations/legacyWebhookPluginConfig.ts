import type {PluginNoProject} from 'sentry/types/integrations';

export const LEGACY_WEBHOOK_PLUGIN: PluginNoProject = {
  id: 'webhooks',
  slug: 'webhooks',
  name: 'Webhooks (Legacy)',
  shortName: 'Webhooks',
  type: 'notification',
  canDisable: true,
  contexts: [],
  doc: '',
  featureDescriptions: [{featureGate: 'alert-rule', description: '', featureId: 1}],
  features: ['alert-rule'],
  hasConfiguration: true,
  isDeprecated: false,
  isHidden: false,
  isTestable: false,
  metadata: {},
  status: 'active',
};
