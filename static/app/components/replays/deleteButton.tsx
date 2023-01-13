import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

function DeleteButton() {
  const api = useApi();
  const navigate = useNavigate();
  const params = useParams();
  const orgSlug = useOrganization().slug;

  const [projectSlug, replayId] = params.replaySlug.split(':');

  const handleDelete = async () => {
    try {
      await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/`,
        {
          method: 'DELETE',
        }
      );
      navigate(`/organizations/${orgSlug}/replays/`, {replace: true});
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
      <Button size="xs" icon={<IconDelete size="xs" />}>
        {t('Delete')}
      </Button>
    </Confirm>
  );
}

export default DeleteButton;
