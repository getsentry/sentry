import React from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Button from 'app/components/button';
import Switch from 'app/components/switch';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {IntegrationWithConfig, Organization, ServerlessFunction} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = {
  serverlessFunction: ServerlessFunction;
  api: Client;
  integration: IntegrationWithConfig;
  organization: Organization;
  onUpdateFunction: (serverlessFunction: ServerlessFunction) => void;
};

class IntegrationServerlessRow extends React.Component<Props> {
  get enabled() {
    return this.props.serverlessFunction.enabled;
  }
  get endpoint() {
    const orgSlug = this.props.organization.slug;
    return `/organizations/${orgSlug}/integrations/${this.props.integration.id}/serverless-functions/`;
  }
  toggleEnable = async () => {
    const action = this.enabled ? 'disable' : 'enable';
    const data = {
      action,
      target: this.props.serverlessFunction.name,
    };
    try {
      addLoadingMessage();
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      this.props.onUpdateFunction(resp);
      addSuccessMessage(t('Success'));
    } catch (err) {
      console.error(err);
      addErrorMessage(err);
    }
  };
  updateVersion = async () => {
    const data = {
      action: 'updateVersion',
      target: this.props.serverlessFunction.name,
    };
    try {
      addLoadingMessage();
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      this.props.onUpdateFunction(resp);
      addSuccessMessage(t('Success'));
    } catch (err) {
      console.error(err);
      addErrorMessage(err);
    }
  };
  render() {
    const {serverlessFunction} = this.props;
    const versionDisplay = this.enabled ? serverlessFunction.version : 'None';
    return (
      <Item>
        <NameWrapper>{serverlessFunction.name}</NameWrapper>
        <RuntimeWrapper>{serverlessFunction.runtime}</RuntimeWrapper>
        <VersionWrapper>{versionDisplay}</VersionWrapper>
        <StyledSwitch isActive={this.enabled} size="sm" toggle={this.toggleEnable} />
        {serverlessFunction.outOfDate && (
          <UpdateButton size="small" priority="primary" onClick={this.updateVersion}>
            Update
          </UpdateButton>
        )}
      </Item>
    );
  }
}

export default withApi(IntegrationServerlessRow);

const Item = styled('div')`
  padding: ${space(1)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2fr 1fr 0.5fr 0.25fr 0.5fr;
  grid-template-areas: 'function-name runtime version enable-switch update-button';
`;

const ItemWrapper = styled('span')``;

const NameWrapper = styled(ItemWrapper)`
  grid-area: function-name;
`;

const RuntimeWrapper = styled(ItemWrapper)`
  grid-area: runtime;
`;

const VersionWrapper = styled(ItemWrapper)`
  grid-area: version;
`;

const StyledSwitch = styled(Switch)`
  grid-area: enable-switch;
`;

const UpdateButton = styled(Button)`
  grid-area: update-button;
`;
