// eslint-disable-next-line simple-import-sort/imports
import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import {IntegrationWithConfig, Organization, ServerlessFunction} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';

import IntegrationServerlessRow from './integrationServerlessRow';

type Props = AsyncComponent['props'] & {
  integration: IntegrationWithConfig;
  organization: Organization;
};

type State = AsyncComponent['state'] & {
  serverlessFunctions: ServerlessFunction[];
};

class IntegrationServerlessFunctions extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      serverlessFunctions: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const orgSlug = this.props.organization.slug;
    return [
      [
        'serverlessFunctions',
        `/organizations/${orgSlug}/integrations/${this.props.integration.id}/serverless-functions/`,
      ],
    ];
  }

  handleFunctionUpdate = (serverlessFunction: ServerlessFunction, index: number) => {
    const [...serverlessFunctions] = this.state.serverlessFunctions;
    serverlessFunctions[index] = serverlessFunction;
    this.setState({serverlessFunctions});
  };

  renderBody() {
    const header = (
      <PanelHeader disablePadding hasButtons>
        <HeaderText>{t('Serverless Functions')}</HeaderText>
      </PanelHeader>
    );

    return (
      <React.Fragment>
        <Panel>
          {header}
          <PanelBody>
            {this.state.serverlessFunctions.map((serverlessFunction, i) => (
              <IntegrationServerlessRow
                key={serverlessFunction.name}
                serverlessFunction={serverlessFunction}
                onUpdateFunction={(response: ServerlessFunction) =>
                  this.handleFunctionUpdate(response, i)
                }
                {...this.props}
              />
            ))}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}

export default withOrganization(IntegrationServerlessFunctions);

const HeaderText = styled('div')`
  padding-left: ${space(2)};
  flex: 1;
`;
