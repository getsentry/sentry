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
import {trackIntegrationEvent} from 'app/utils/integrationUtil';
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

  recordAction = (action: 'enable' | 'disable' | 'updateVersion') => {
    trackIntegrationEvent(
      {
        eventKey: 'integrations.serverless_function_action',
        eventName: 'Integrations: Serverless Function Action',
        integration: this.props.integration.provider.key,
        integration_type: 'first_party',
        action,
      },
      this.props.organization
    );
  };
  toggleEnable = async () => {
    const action = this.enabled ? 'disable' : 'enable';
    const data = {
      action,
      target: this.props.serverlessFunction.name,
    };
    try {
      addLoadingMessage();
      this.recordAction(action);
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      this.props.onUpdateFunction(resp);
      addSuccessMessage(t('Success'));
    } catch (err) {
      // TODO: specific error handling
      addErrorMessage(t('An error ocurred'));
    }
  };
  updateVersion = async () => {
    const data = {
      action: 'updateVersion',
      target: this.props.serverlessFunction.name,
    };
    try {
      addLoadingMessage();
      this.recordAction('updateVersion');
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      this.props.onUpdateFunction(resp);
      addSuccessMessage(t('Success'));
    } catch (err) {
      // TODO: specific error handling
      addErrorMessage(t('An error ocurred'));
    }
  };
  renderLayerStatus() {
    const {serverlessFunction} = this.props;
    if (!serverlessFunction.outOfDate) {
      return this.enabled ? t('Latest') : t('Disabled');
    }
    return (
      <UpdateButton size="small" priority="primary" onClick={this.updateVersion}>
        {t('Update')}
      </UpdateButton>
    );
  }
  render() {
    const {serverlessFunction} = this.props;
    const versionText = this.enabled ? (
      <React.Fragment>&nbsp;|&nbsp;v{serverlessFunction.version}</React.Fragment>
    ) : null;
    return (
      <Item>
        <NameWrapper>
          <NameRuntimeVersionWrapper>
            <Name>{serverlessFunction.name}</Name>
            <RuntimeAndVersion>
              <DetailWrapper>{serverlessFunction.runtime}</DetailWrapper>
              <DetailWrapper>{versionText}</DetailWrapper>
            </RuntimeAndVersion>
          </NameRuntimeVersionWrapper>
        </NameWrapper>
        <LayerStatusWrapper>{this.renderLayerStatus()}</LayerStatusWrapper>
        <StyledSwitch isActive={this.enabled} size="sm" toggle={this.toggleEnable} />
      </Item>
    );
  }
}

export default withApi(IntegrationServerlessRow);

const Item = styled('div')`
  padding: ${space(2)};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }

  display: grid;
  grid-column-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 2fr 1fr 0.5fr;
  grid-template-areas: 'function-name layer-status enable-switch';
`;

const ItemWrapper = styled('span')`
  height: 32px;
  vertical-align: middle;
  display: flex;
  align-items: center;
`;

const NameWrapper = styled(ItemWrapper)`
  grid-area: function-name;
`;

const LayerStatusWrapper = styled(ItemWrapper)`
  grid-area: layer-status;
`;

const StyledSwitch = styled(Switch)`
  grid-area: enable-switch;
`;

const UpdateButton = styled(Button)``;

const NameRuntimeVersionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
`;

const Name = styled(`span`)`
  padding-bottom: ${space(1)};
`;

const RuntimeAndVersion = styled('div')`
  display: flex;
  flex-direction: row;
  color: ${p => p.theme.gray300};
`;

const DetailWrapper = styled('div')`
  line-height: 1.2;
`;
