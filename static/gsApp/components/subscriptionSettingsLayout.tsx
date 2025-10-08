import styled from '@emotion/styled';

import {Container, Flex} from 'sentry/components/core/layout';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsBreadcrumb from 'sentry/views/settings/components/settingsBreadcrumb';
import SettingsHeader from 'sentry/views/settings/components/settingsHeader';
import SettingsSearch from 'sentry/views/settings/components/settingsSearch';
import OrganizationSettingsLayout from 'sentry/views/settings/organization/organizationSettingsLayout';

import {hasNewBillingUI} from 'getsentry/utils/billing';

type Props = {
  children: React.ReactNode;
};

function SubscriptionSettingsLayout(props: Props) {
  const organization = useOrganization();
  const isNewBillingUI = hasNewBillingUI(organization);

  const location = useLocation();
  const params = useParams();
  const routes = useRoutes();
  const router = useRouter();
  const {children} = props;

  if (!isNewBillingUI) {
    return (
      <OrganizationSettingsLayout
        {...props}
        params={params}
        routes={routes}
        location={location}
        router={router}
        routeParams={params}
        route={routes[0]!} // XXX: this component doesn't actually use the route prop so i think this is okay to satisfy RouteComponentProps
      />
    );
  }

  return (
    <SettingsColumn direction="column" flex={1} minWidth="0">
      <StyledSettingsHeader>
        <Flex align="center" justify="between">
          <StyledSettingsBreadcrumb params={params} routes={routes} />
          <SettingsSearch />
        </Flex>
      </StyledSettingsHeader>

      <Flex flex="1">
        <Container minWidth={0} flex={1}>
          {children}
        </Container>
      </Flex>
    </SettingsColumn>
  );
}

export default SubscriptionSettingsLayout;

const SettingsColumn = styled(Flex)`
  footer {
    margin-top: 0;
  }
`;

const StyledSettingsBreadcrumb = styled(SettingsBreadcrumb)`
  flex: 1;
`;

const StyledSettingsHeader = styled(SettingsHeader)`
  border: none;
`;
