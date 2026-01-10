import {useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import ConfirmDelete from 'sentry/components/confirmDelete';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ApiApplication} from 'sentry/types/user';
import useApi from 'sentry/utils/useApi';

const ROUTE_PREFIX = '/settings/account/api/';

type Props = {
  app: ApiApplication;
  onRemove: (app: ApiApplication) => void;
};

function Row({app, onRemove}: Props) {
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
    <StyledPanelItem>
      <ApplicationNameWrapper>
        <ApplicationName to={`${ROUTE_PREFIX}applications/${app.id}/`}>
          {app.name}
        </ApplicationName>
        <ClientId>{app.clientID}</ClientId>
      </ApplicationNameWrapper>

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
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(2)};
  align-items: center;
`;

const ApplicationNameWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  margin-right: ${space(1)};
`;

const ApplicationName = styled(Link)`
  margin-bottom: ${space(1)};
`;

const ClientId = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
`;

export default Row;
