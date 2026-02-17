export const DSN_PATTERN = /^https?:\/\/([a-f0-9]{32})(:[a-f0-9]{32})?@[^/]+\/\d+$/;

export interface DsnLookupResponse {
  keyId: string;
  keyLabel: string;
  organizationSlug: string;
  projectId: string;
  projectName: string;
  projectPlatform: string | null;
  projectSlug: string;
}
