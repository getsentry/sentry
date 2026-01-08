import {useNavigate} from 'react-router-dom';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {getListBuildUrl} from 'sentry/views/preprod/utils/buildLinkUtils';

interface UseBuildDetailsActionsProps {
  artifactId: string;
  projectId: string;
}

type ErrorDetail = string | {code?: string; message?: string} | null | undefined;

function handleStaffPermissionError(responseDetail: ErrorDetail) {
  if (typeof responseDetail !== 'string' && responseDetail?.code === 'staff-required') {
    addErrorMessage(
      t(
        'Re-authenticate as staff first and then return to this page and try again. Redirecting...'
      )
    );
    setTimeout(() => {
      window.location.href = '/_admin/';
    }, 2000);
    return;
  }

  addErrorMessage(t('Access denied. You may need to re-authenticate as staff.'));
}

export function useBuildDetailsActions({
  projectId,
  artifactId,
}: UseBuildDetailsActionsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();

  const {mutate: deleteArtifact, isPending: isDeletingArtifact} = useMutation<
    void,
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({
        url: `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/delete/`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Build deleted successfully'));
      // TODO(preprod): navigate back to the release page once built?
      navigate(
        getListBuildUrl({
          organizationSlug: organization.slug,
          projectId,
        })
      );
    },
    onError: () => {
      addErrorMessage(t('Failed to delete build'));
    },
  });

  const handleDeleteArtifact = () => {
    deleteArtifact();
  };

  const {mutate: rerunAnalysis} = useMutation<void, RequestError>({
    mutationFn: () => {
      return fetchMutation({
        url: `/internal/preprod-artifact/rerun-analysis/`,
        method: 'POST',
        data: {
          preprod_artifact_id: artifactId,
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Analysis rerun initiated successfully'));
    },
    onError: error => {
      if (error.status === 403) {
        handleStaffPermissionError(error.responseJSON?.detail);
      } else {
        addErrorMessage(t('Failed to rerun analysis'));
      }
    },
  });

  const handleRerunAction = () => {
    rerunAnalysis();
  };

  const handleDownloadAction = async () => {
    const downloadUrl = `/api/0/internal/${organization.slug}/${projectId}/files/preprodartifacts/${artifactId}/`;

    try {
      // We use a HEAD request to enable large file downloads using chunked downloading.
      const response = await fetch(downloadUrl, {
        method: 'HEAD',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 403) {
          let detail: ErrorDetail = null;
          try {
            // HEAD requests don't include a response body per HTTP spec, so we make a follow-up GET call to retrieve the error details and check for the staff-required code.
            const errorResponse = await fetch(downloadUrl, {
              method: 'GET',
              credentials: 'include',
            });
            const errorText = await errorResponse.text();
            const errorJson = JSON.parse(errorText);
            detail = errorJson.detail;
          } catch {
            // Fall through to generic handling
          }
          handleStaffPermissionError(detail);
        } else if (response.status === 404) {
          addErrorMessage(t('Build file not found.'));
        } else if (response.status === 401) {
          addErrorMessage(t('Unauthorized.'));
        } else {
          addErrorMessage(t('Download failed (status: %s)', response.status));
        }
        return;
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `preprod_artifact_${artifactId}.zip`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      addSuccessMessage(t('Build download started'));
    } catch (error) {
      addErrorMessage(t('Download failed: %s', String(error)));
    }
  };

  const {mutate: rerunStatusChecks, isPending: isRerunningStatusChecks} = useMutation<
    void,
    RequestError
  >({
    mutationFn: () => {
      return fetchMutation({
        url: `/projects/${organization.slug}/${projectId}/preprod-artifact/rerun-status-checks/${artifactId}/`,
        method: 'POST',
        data: {
          check_types: ['size'],
        },
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Status checks rerun initiated successfully'));
    },
    onError: () => {
      addErrorMessage(t('Failed to rerun status checks'));
    },
  });

  const handleRerunStatusChecksAction = () => {
    rerunStatusChecks();
  };

  return {
    // State
    isDeletingArtifact,
    isRerunningStatusChecks,

    // Actions
    handleDeleteArtifact,
    handleRerunAction,
    handleDownloadAction,
    handleRerunStatusChecksAction,
  };
}
