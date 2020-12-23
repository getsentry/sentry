import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import Button from 'app/components/button';
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
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      this.props.onUpdateFunction(resp);
    } catch (err) {
      console.error(err);
    }
  };
  updateVersion = async () => {
    const data = {
      action: 'update',
      target: this.props.serverlessFunction.name,
    };
    try {
      const resp = await this.props.api.requestPromise(this.endpoint, {
        method: 'POST',
        data,
      });
      this.props.onUpdateFunction(resp);
    } catch (err) {
      console.error(err);
    }
  };
  render() {
    const {serverlessFunction} = this.props;
    const buttonText = this.enabled ? 'Disable' : 'Enable';
    return (
      <div>
        <ItemWrapper>{serverlessFunction.name}</ItemWrapper>
        <ItemWrapper>{serverlessFunction.runtime}</ItemWrapper>
        <ItemWrapper>{serverlessFunction.outOfDate}</ItemWrapper>
        <ItemWrapper>{serverlessFunction.version}</ItemWrapper>
        <Button onClick={this.toggleEnable}>{buttonText}</Button>
        {serverlessFunction.outOfDate && (
          <Button onClick={this.updateVersion}>Update</Button>
        )}
      </div>
    );
  }
}

export default withApi(IntegrationServerlessRow);

const ItemWrapper = styled('span')`
  margin: 10px;
`;
