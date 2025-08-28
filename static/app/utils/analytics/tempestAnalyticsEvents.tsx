import type {Organization} from 'sentry/types/organization';

type TempestEventBase = {
  organization: Organization;
  project_slug: string;
};

type TempestEventBaseWithOrigin = TempestEventBase & {
  origin: 'onboarding' | 'project-creation' | 'project-settings';
};

export type TempestEventParameters = {
  'tempest.credentials.add_modal_opened': TempestEventBaseWithOrigin;
  'tempest.credentials.added': TempestEventBaseWithOrigin;
  'tempest.credentials.error_displayed': TempestEventBase & {
    error_count: number;
  };
  'tempest.credentials.removed': TempestEventBase;
  'tempest.sdk_access_modal_opened': TempestEventBaseWithOrigin;
  'tempest.sdk_access_modal_submitted': TempestEventBaseWithOrigin;
};

type TempestEventKey = keyof TempestEventParameters;

export const tempestEventMap: Record<TempestEventKey, string | null> = {
  'tempest.credentials.add_modal_opened': 'Tempest: Credentials Add Modal Opened',
  'tempest.credentials.added': 'Tempest: Credentials Added',
  'tempest.credentials.error_displayed': 'Tempest: Error Displayed',
  'tempest.credentials.removed': 'Tempest: Credentials Removed',
  'tempest.sdk_access_modal_opened': 'Tempest: SDK Access Modal Opened',
  'tempest.sdk_access_modal_submitted': 'Tempest: SDK Access Modal Submitted',
};
