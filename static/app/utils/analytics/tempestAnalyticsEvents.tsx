import type {Organization} from 'sentry/types/organization';

export type TempestEventParameters = {
  'tempest.credentials.add_modal_opened': {
    organization: Organization;
    project_slug: string;
  };
  'tempest.credentials.added': {
    organization: Organization;
    project_slug: string;
  };
  'tempest.credentials.error_displayed': {
    error_count: number;
    organization: Organization;
    project_slug: string;
  };
  'tempest.credentials.removed': {
    organization: Organization;
    project_slug: string;
  };
  'tempest.sdk_access_modal_opened': {
    organization: Organization;
    project_slug: string;
  };
  'tempest.sdk_access_modal_submitted': {
    organization: Organization;
    project_slug: string;
  };
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
