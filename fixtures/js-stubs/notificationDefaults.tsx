export const NotificationDefaults = () => ({
  providerDefaults: ['email', 'slack'],
  typeDefaults: {
    alerts: 'always',
    approval: 'always',
    deploy: 'committed_only',
    quota: 'always',
    quotaAttachments: 'always',
    quotaErrors: 'always',
    quotaReplays: 'always',
    quotaSpendAllocations: 'always',
    quotaTransactions: 'always',
    quotaWarnings: 'always',
    spikeProtection: 'always',
    workflow: 'subscribe_only',
  },
});
