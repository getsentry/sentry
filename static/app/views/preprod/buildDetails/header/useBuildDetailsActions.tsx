import {useNavigate} from 'react-router';
import {useMutation} from '@tanstack/react-query';

import {toast} from '@sentry/scraps/toast';

import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {downloadPreprodArtifact} from 'sentry/utils/downloadPreprodArtifact';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';
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
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/delete/',
          {path: {organizationIdOrSlug: organization.slug, headArtifactId: artifactId}}
        ),
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast.success(t('Build deleted successfully'));
      navigate(makeReleasesUrl(organization.slug, projectId));
    },
    onError: () => {
      toast.error(t('Failed to delete build'));
    },
  });

  const handleDeleteArtifact = () => {
    deleteArtifact();
  };

  const {mutate: rerunAnalysis} = useMutation<void, RequestError>({
    mutationFn: () => {
      return fetchMutation({
        url: getApiUrl('/internal/preprod-artifact/rerun-analysis/'),
        method: 'POST',
        data: {
          preprod_artifact_id: artifactId,
        },
      });
    },
    onSuccess: () => {
      toast.success(t('Analysis rerun initiated successfully'));
    },
    onError: error => {
      if (error.status === 403) {
        handleStaffPermissionError(error.responseJSON?.detail);
      } else {
        toast.error(t('Failed to rerun analysis'));
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
        url: getApiUrl(
          '/organizations/$organizationIdOrSlug/preprod-artifact/rerun-status-checks/$headArtifactId/',
          {path: {organizationIdOrSlug: organization.slug, headArtifactId: artifactId}}
        ),
        method: 'POST',
        data: {
          check_types: ['size'],
        },
      });
    },
    onSuccess: () => {
      toast.success(t('Status checks rerun initiated successfully'));
    },
    onError: () => {
      toast.error(t('Failed to rerun status checks'));
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
