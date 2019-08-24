import React from 'react';
import styled from 'react-emotion';

import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {PageContent} from 'app/styles/organization';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import SentryTypes from 'app/sentryTypes';

const Body = styled('div')`
  background-color: ${p => p.theme.whiteDark};
  flex-direction: column;
  flex: 1;
`;

class MonitorsContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization, children} = this.props;

    return (
      <Feature features={['monitors']} renderDisabled>
        <GlobalSelectionHeader
          organization={organization}
          showEnvironmentSelector={false}
          showDateSelector={false}
          resetParamsOnChange={['cursor']}
        />
        <PageContent>
          <Body>{children}</Body>
        </PageContent>
      </Feature>
    );
  }
}

export default withOrganization(withGlobalSelection(MonitorsContainer));
export {MonitorsContainer};
