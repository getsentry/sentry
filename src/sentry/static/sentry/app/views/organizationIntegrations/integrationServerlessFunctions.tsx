// eslint-disable-next-line simple-import-sort/imports
import React from 'react';
import styled from '@emotion/styled';

import AsyncComponent from 'app/components/asyncComponent';
import {IntegrationWithConfig, Organization} from 'app/types';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import {t} from 'app/locale';

type ServerlessFunction = {
  name: string;
  runtime: string;
  version: number;
  outOfDate: boolean;
  enabled: boolean;
};

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
    const orgId = this.props.organization.slug;
    return [
      [
        'serverlessFunctions',
        `/organizations/${orgId}/integrations/${this.props.integration.id}/serverless-functions/`,
      ],
    ];
  }

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
          <PanelBody>Hey</PanelBody>
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
