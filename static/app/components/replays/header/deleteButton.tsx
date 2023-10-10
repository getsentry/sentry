import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

interface DeleteButtonProps {
  projectSlug: string;
  replayId: string;
}

function DeleteButton({projectSlug, replayId}: DeleteButtonProps) {
  const api = useApi();
  const navigate = useNavigate();
  const organization = useOrganization();

  const handleDelete = async () => {
    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/replays/${replayId}/`,
        {
          method: 'DELETE',
        }
      );
      navigate(`/organizations/${organization.slug}/replays/`, {replace: true});
    } catch (err) {
      addErrorMessage(t('Failed to delete replay'));
      Sentry.captureException(err);
    }
  };

  return (
    <Confirm
      message={t('Are you sure you want to delete this replay?')}
      onConfirm={handleDelete}
    >
      <Button size="sm" icon={<IconDelete size="sm" />}>
        {t('Delete')}
      </Button>
    </Confirm>
  );
}

export default DeleteButton;
