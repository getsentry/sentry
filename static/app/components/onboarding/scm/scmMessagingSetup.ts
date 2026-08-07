type ScmMessagingProviderKey = 'discord' | 'msteams' | 'slack';

export type ScmMessagingSetup =
  | {mode: 'unconfigured'}
  | {mode: 'skipped'}
  | {
      channelId: string;
      integrationId: string;
      mode: 'selected';
      providerKey: ScmMessagingProviderKey;
      channelName?: string;
    };

export const UNCONFIGURED_SCM_MESSAGING_SETUP = {
  mode: 'unconfigured',
} as const satisfies ScmMessagingSetup;
