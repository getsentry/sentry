import {useState} from 'react';
import {useNavigate} from 'react-router-dom';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

interface UseBuildDetailsActionsProps {
  projectId: string;
  artifactId?: string;
}

export function useBuildDetailsActions({
  projectId,
  artifactId,
}: UseBuildDetailsActionsProps) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const [isDeletingArtifact, setIsDeletingArtifact] = useState(false);

  const handleDeleteArtifact = async () => {
    if (!artifactId) {
      addErrorMessage('Artifact ID is required to delete the build');
      return;
    }

    setIsDeletingArtifact(true);

    try {
      const api = new Client();
      await api.requestPromise(
        `/projects/${organization.slug}/${projectId}/preprodartifacts/${artifactId}/delete/`,
        {
          method: 'DELETE',
        }
      );

      addSuccessMessage('Build deleted successfully');
      // Navigate back to the preprod builds list
      navigate(`/organizations/${organization.slug}/preprod/${projectId}/`);
    } catch (error) {
      addErrorMessage('Failed to delete build');
    } finally {
      setIsDeletingArtifact(false);
    }
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
