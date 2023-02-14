import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Switch from 'sentry/components/switchButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IntegrationWithConfig, Organization, ServerlessFunction} from 'sentry/types';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  integration: IntegrationWithConfig;
  onUpdateFunction: (serverlessFunctionUpdate: Partial<ServerlessFunction>) => void;
  organization: Organization;
  serverlessFunction: ServerlessFunction;
};

type State = {
  submitting: boolean;
};

class IntegrationServerlessRow extends Component<Props, State> {
  state: State = {
    submitting: false,
  };
  get enabled() {
    return this.props.serverlessFunction.enabled;
  }
  get endpoint() {
    const orgSlug = this.props.organization.slug;
    return `/organizations/${orgSlug}/integrations/${this.props.integration.id}/serverless-functions/`;
  }

  recordAction = (action: 'enable' | 'disable' | 'updateVersion') => {
    trackIntegrationAnalytics('integrations.serverless_function_action', {
      integration: this.props.integration.provider.key,
      integration_type: 'first_party',
      action,
      organization: this.props.organization,
    });
  };
  toggleEnable = async () => {
    const {serverlessFunction} = this.props;
    const action = this.enabled ? 'disable' : 'enable';
    const data = {
      action,
      target: serverlessFunction.name,
    };
    try {
      addLoadingMessage();
      this.setState({submitting: true});
      // optimistically update enable state
      this.props.onUpdateFunction({enabled: !this.enabled});
      this.recordAction(action);
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      // update remaining after response
      this.props.onUpdateFunction(resp);
      addSuccessMessage(t('Success'));
    } catch (err) {
      // restore original on failure
      this.props.onUpdateFunction(serverlessFunction);
      addErrorMessage(err.responseJSON?.detail ?? t('Error occurred'));
    }
    this.setState({submitting: false});
  };
  updateVersion = async () => {
    const {serverlessFunction} = this.props;
    const data = {
      action: 'updateVersion',
      target: serverlessFunction.name,
    };
    try {
      this.setState({submitting: true});
      // don't know the latest version but at least optimistically remove the update button
      this.props.onUpdateFunction({outOfDate: false});
      addLoadingMessage();
      this.recordAction('updateVersion');
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      // update remaining after response
      this.props.onUpdateFunction(resp);
      addSuccessMessage(t('Success'));
    } catch (err) {
      // restore original on failure
      this.props.onUpdateFunction(serverlessFunction);
      addErrorMessage(err.responseJSON?.detail ?? t('Error occurred'));
    }
    this.setState({submitting: false});
  };
  renderLayerStatus() {
    const {serverlessFunction} = this.props;
    if (!serverlessFunction.outOfDate) {
      return this.enabled ? t('Latest') : t('Disabled');
    }
    return (
      <UpdateButton size="sm" priority="primary" onClick={this.updateVersion}>
        {t('Update')}
      </UpdateButton>
    );
  }
  render() {
    const {serverlessFunction} = this.props;
    const {version} = serverlessFunction;
    // during optimistic update, we might be enabled without a version
    const versionText =
      this.enabled && version > 0 ? <Fragment>&nbsp;|&nbsp;v{version}</Fragment> : null;
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
        <StyledSwitch
          isActive={this.enabled}
          isDisabled={this.state.submitting}
          size="sm"
          toggle={this.toggleEnable}
        />
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
