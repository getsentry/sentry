import {useNavigate} from 'react-router-dom';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

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
      navigate(`/organizations/${organization.slug}/preprod/${projectId}/`);
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

  return {
    // State
    isDeletingArtifact,

    // Actions
    handleDeleteAction,
  };
}
