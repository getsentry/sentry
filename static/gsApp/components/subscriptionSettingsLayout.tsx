import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {Flex} from 'sentry/components/core/layout';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useRouter from 'sentry/utils/useRouter';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsBreadcrumb from 'sentry/views/settings/components/settingsBreadcrumb';
import type {RouteWithName} from 'sentry/views/settings/components/settingsBreadcrumb/types';
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
  const openFeedbackForm = useFeedbackForm();

  const location = useLocation();
  const params = useParams();
  const routes = useRoutes();
  const router = useRouter();
  const {children} = props;
  let feedbackSource = location.pathname;
  for (let i = routes.length - 1; i >= 0; i--) {
    const route = routes[i] as RouteWithName;
    if (route?.name) {
      feedbackSource = route.name;
      break;
    }
  }
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
          <Flex align="center" gap="xl">
            {openFeedbackForm ? (
              <Button
                size="sm"
                icon={<IconMegaphone />}
                onClick={() => {
                  openFeedbackForm({
                    formTitle: t('Give feedback'),
                    messagePlaceholder: t(
                      'How can we make the %s page better for you?',
                      feedbackSource
                    ),
                    tags: {
                      ['feedback.source']: feedbackSource,
                      ['feedback.owner']: 'billing',
                    },
                  });
                }}
              >
                {t('Give feedback')}
              </Button>
            ) : null}
            <SettingsSearch />
          </Flex>
        </Flex>
      </StyledSettingsHeader>
      <Flex minWidth={0} flex="1" direction="column">
        {children}
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
