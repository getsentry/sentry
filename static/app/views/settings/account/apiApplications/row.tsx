import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {ConfirmDelete} from 'sentry/components/confirmDelete';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {ApiApplication} from 'sentry/types/user';
import {useApi} from 'sentry/utils/useApi';

const ROUTE_PREFIX = '/settings/account/api/';

type Props = {
  app: ApiApplication;
  onRemove: (app: ApiApplication) => void;
};

export function Row({app, onRemove}: Props) {
  const api = useApi();
  const [isLoading, setLoading] = useState(false);

  async function handleRemove() {
    if (isLoading) {
      return;
    }

    setLoading(true);
    addLoadingMessage();

    try {
      await api.requestPromise(`/api-applications/${app.id}/`, {
        method: 'DELETE',
      });

      clearIndicators();
      onRemove(app);
    } catch (_err) {
      addErrorMessage(t('Unable to remove application. Please try again.'));
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

      <SimpleTable.RowCell data-column-name="age">
        {app.dateCreated ? (
          <TimeSince date={app.dateCreated} suffix="" />
        ) : (
          <Text as="span" variant="muted">
            -
          </Text>
        )}
      </SimpleTable.RowCell>

      <SimpleTable.RowCell justify="end" data-column-name="actions">
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
