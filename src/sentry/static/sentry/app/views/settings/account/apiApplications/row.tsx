import React from 'react';
import styled from '@emotion/styled';

import Link from 'app/components/links/link';
import {ApiApplication} from 'app/types';
import {Client} from 'app/api';
import {PanelItem} from 'app/components/panels';
import {
  addErrorMessage,
  addLoadingMessage,
  clearIndicators,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import Button from 'app/components/button';
import {IconDelete} from 'app/icons';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

const ROUTE_PREFIX = '/settings/account/api/';

type Props = {
  api: Client;
  app: ApiApplication;
  onRemove: (app: ApiApplication) => void;
};

type State = {
  loading: boolean;
};

class Row extends React.Component<Props, State> {
  state = {
    loading: false,
  };

  handleRemove = () => {
    if (this.state.loading) {
      return;
    }

    const {api, app, onRemove} = this.props;

    this.setState(
      {
        loading: true,
      },
      async () => {
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
    );
  };

  render() {
    const {app} = this.props;

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
          onClick={this.handleRemove}
          disabled={this.state.loading}
          icon={<IconDelete />}
        />
      </StyledPanelItem>
    );
  }
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
  font-size: ${p => p.theme.headerFontSize};
  font-weight: bold;
  margin-bottom: ${space(0.5)};
`;

const ClientId = styled('div')`
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeMedium};
`;

export default Row;
