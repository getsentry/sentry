import {useNavigate} from 'react-router-dom';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

interface UseBuildDetailsActionsProps {
  artifactId: string;
  projectSlug: string;
}

export function useBuildDetailsActions({
  projectSlug,
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
        url: `/projects/${organization.slug}/${projectSlug}/preprodartifacts/${artifactId}/delete/`,
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      addSuccessMessage(t('Build deleted successfully'));
      // TODO(preprod): navigate back to the release page once built?
      navigate(`/organizations/${organization.slug}/preprod/${projectSlug}/`);
    },
    onError: () => {
      addErrorMessage(t('Failed to delete build'));
    },
  });

  const handleDeleteArtifact = () => {
    deleteArtifact();
  };

  const handleDeleteAction = () => {
    openConfirmModal({
      message: t(
        'Are you sure you want to delete this build? This action cannot be undone and will permanently remove all associated files and data.'
      ),
      onConfirm: handleDeleteArtifact,
    });
  };

  const handleDownloadAction = async () => {
    const downloadUrl = `/api/0/internal/${organization.slug}/${projectSlug}/files/preprodartifacts/${artifactId}/`;

    try {
      const response = await fetch(downloadUrl, {
        method: 'HEAD',
        credentials: 'include',
      });

      if (!response.ok) {
        let errorMessage = `Download failed (${response.status})`;

        let errorResponse: Response;
        try {
          errorResponse = await fetch(downloadUrl, {
            method: 'GET',
            credentials: 'include',
          });
        } catch {
          if (response.status === 403) {
            errorMessage = 'Access denied. You may need to re-authenticate as staff.';
          } else if (response.status === 404) {
            errorMessage = 'Build file not found.';
          } else if (response.status === 401) {
            errorMessage = 'Unauthorized.';
          }
          addErrorMessage(t('Download failed: %s', errorMessage));
          return;
        }

        if (!errorResponse.ok) {
          const errorText = await errorResponse.text();
          let errorJson: any;
          try {
            errorJson = JSON.parse(errorText);
          } catch {
            addErrorMessage(t('Download failed: %s', errorText || errorMessage));
            return;
          }

          if (errorJson.detail) {
            if (typeof errorJson.detail === 'string') {
              errorMessage = errorJson.detail;
            } else if (errorJson.detail.message) {
              errorMessage = errorJson.detail.message;
            } else if (errorJson.detail.code) {
              errorMessage = `${errorJson.detail.code}: ${errorJson.detail.message || 'Authentication required'}`;
            }
          }
        }

        addErrorMessage(t('Download failed: %s', errorMessage));
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

  return {
    // State
    isDeletingArtifact,

    // Actions
    handleDeleteAction,
    handleDownloadAction,
  };
}
