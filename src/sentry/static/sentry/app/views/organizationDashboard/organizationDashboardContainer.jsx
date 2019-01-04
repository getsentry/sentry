import {Flex} from 'grid-emotion';
import {withRouter} from 'react-router';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import BetaTag from 'app/components/betaTag';
import Feature from 'app/components/acl/feature';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

class OrganizationDashboardContainer extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization, children} = this.props;

    const projects =
      organization.projects && organization.projects.filter(({isMember}) => isMember);

    return (
      <OrganizationDashboardContent>
        <Feature features={['sentry10']} renderDisabled>
          <GlobalSelectionHeader
            organization={organization}
            projects={projects}
            showAbsolute={true}
            showRelative={true}
          />

          <Body>
            <Flex align="center" justify="space-between" mb={2}>
              <HeaderTitle>
                {t('Dashboard')} <BetaTag />
              </HeaderTitle>
            </Flex>

            {children}
          </Body>
        </Feature>
      </OrganizationDashboardContent>
    );
  }
}
export default withRouter(withOrganization(OrganizationDashboardContainer));
export {OrganizationDashboardContainer};

const OrganizationDashboardContent = styled(Flex)`
  flex-direction: column;
  flex: 1;
  overflow: hidden;
  margin-bottom: -20px; /* <footer> has margin-top: 20px; */
`;

const Body = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: ${space(2)} ${space(4)} ${space(3)};
`;

const HeaderTitle = styled('h4')`
  flex: 1;
  font-size: ${p => p.theme.headerFontSize};
  line-height: ${p => p.theme.headerFontSize};
  font-weight: normal;
  color: ${p => p.theme.gray4};
  margin: 0;
`;
