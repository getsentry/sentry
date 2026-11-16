import {useState} from 'react';
import {IconDelete} from '@sentry/icons/delete';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {ApiApplication} from 'sentry/types/user';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';

const ROUTE_PREFIX = '/settings/account/api/';

type Props = {
  app: ApiApplication;
  onRemove: (app: ApiApplication) => void;
};

export function Row({app, onRemove}: Props) {
  const [isLoading, setLoading] = useState(false);

  const {mutateAsync: deleteApplication} = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl('/api-applications/$appId/', {path: {appId: app.id}}),
        method: 'DELETE',
      }),
  });

  async function handleRemove() {
    if (isLoading) {
      return;
    }

    setLoading(true);
    toast.loading(t('Saving changes...'));

    try {
      await deleteApplication();

      toast.dismiss();
      onRemove(app);
    } catch (_err) {
      toast.error(t('Unable to remove application. Please try again.'));
    }
  }

  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell>
        <Stack flex="1" minWidth="0">
          <Link to={`${ROUTE_PREFIX}applications/${app.id}/`}>{app.name}</Link>
          <Text as="span" variant="muted" size="sm" monospace ellipsis>
            {app.clientID}
          </Text>
        </Stack>
      </SimpleTable.RowCell>

      <SimpleTable.RowCell>
        {app.dateCreated ? (
          <TimeSince date={app.dateCreated} suffix="" />
        ) : (
          <Text as="span" variant="muted">
            -
          </Text>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end" padding="lg xl lg 0">
        <ConfirmDelete
          message={t(
            'Removing this API Application will break existing usages of the application!'
          )}
          confirmInput={app.name}
          onConfirm={handleRemove}
        >
          <Button disabled={isLoading} size="sm" icon={<IconDelete />}>
            {t('Remove')}
          </Button>
        </ConfirmDelete>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
