import {useState} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ApiApplication} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
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
          {getDynamicText({value: app.name, fixed: 'CI_APPLICATION_NAME'})}
        </ApplicationName>
        <ClientId>
          {getDynamicText({value: app.clientID, fixed: 'CI_CLIENT_ID'})}
        </ClientId>
      </ApplicationNameWrapper>

      <Button
        aria-label="Remove"
        onClick={handleRemove}
        disabled={isLoading}
        size="sm"
        icon={<IconDelete size="sm" />}
      />
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
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default Row;
