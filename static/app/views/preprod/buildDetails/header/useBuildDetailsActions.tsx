import {useNavigate} from 'react-router-dom';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {downloadPreprodArtifact} from 'sentry/utils/downloadPreprodArtifact';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {getListBuildPath} from 'sentry/views/preprod/utils/buildLinkUtils';
import {handleStaffPermissionError} from 'sentry/views/preprod/utils/staffPermissionError';

interface UseBuildDetailsActionsProps {
  artifactId: string;
  projectId: string;
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
        getListBuildPath({
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
    await downloadPreprodArtifact({
      organizationSlug: organization.slug,
      projectSlug: projectId,
      artifactId,
      onStaffPermissionError: handleStaffPermissionError,
    });
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
