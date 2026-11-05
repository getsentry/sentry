import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';

import {downloadFromHref} from './downloadFromHref';

type ErrorDetail = {
  code?: string;
  message?: string;
} | null;

interface DownloadPreprodArtifactOptions {
  artifactId: string | number;
  organizationSlug: string;
  projectSlug: string;
  onStaffPermissionError?: (detail: ErrorDetail) => void;
  regionUrl?: string;
}

export async function downloadPreprodArtifact({
  organizationSlug,
  projectSlug,
  artifactId,
  regionUrl,
  onStaffPermissionError,
}: DownloadPreprodArtifactOptions): Promise<void> {
  const baseUrl = regionUrl || '';
  const downloadUrl = `${baseUrl}/api/0/internal/${organizationSlug}/${projectSlug}/files/preprodartifacts/${artifactId}/`;

  try {
    const response = await fetch(downloadUrl, {
      method: 'HEAD',
      credentials: 'include',
    });

    if (!response.ok) {
      if (response.status === 403) {
        let detail: ErrorDetail = null;
        try {
          const errorResponse = await fetch(downloadUrl, {
            method: 'GET',
            credentials: 'include',
          });
          const errorText = await errorResponse.text();
          const errorJson = JSON.parse(errorText);
          detail = errorJson.detail;
        } catch {
          detail = null;
        }

        if (onStaffPermissionError) {
          onStaffPermissionError(detail);
        } else {
          toast.error(t('Permission denied. Staff access may be required.'));
        }
      } else if (response.status === 404) {
        toast.error(t('Build file not found.'));
      } else if (response.status === 401) {
        toast.error(t('Unauthorized.'));
      } else {
        toast.error(t('Download failed (status: %s)', response.status));
      }
      return;
    }

    downloadFromHref(`preprod_artifact_${artifactId}.zip`, downloadUrl);

    toast.success(t('Build download started'));
  } catch (error) {
    toast.error(t('Download failed: %s', String(error)));
  }
}
