import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/button';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useRouteContext} from 'sentry/utils/useRouteContext';

function DeleteButton() {
  const api = useApi();
  const {params, router} = useRouteContext();

  const orgSlug = params.orgId;
  const [projectSlug, replayId] = params.replaySlug.split(':');

  const handleDelete = async () => {
    try {
      await api.requestPromise(
        `/projects/${orgSlug}/${projectSlug}/replays/${replayId}/`,
        {
          method: 'DELETE',
        }
      );
      router.replace(`/organizations/${orgSlug}/replays/`);
    } catch (err) {
      addErrorMessage(t('Failed to delete replay'));
      Sentry.captureException(err);
    }
  };

  return (
    <Button size="xs" icon={<IconDelete size="xs" />} onClick={handleDelete}>
      {t('Delete')}
    </Button>
  );
}

export default DeleteButton;
