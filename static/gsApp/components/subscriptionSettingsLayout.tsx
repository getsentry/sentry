import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import SettingsBreadcrumb from 'sentry/views/settings/components/settingsBreadcrumb';
import type {RouteWithName} from 'sentry/views/settings/components/settingsBreadcrumb/types';
import SettingsHeader from 'sentry/views/settings/components/settingsHeader';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import SettingsSearch from 'sentry/views/settings/components/settingsSearch';

import {hasNewBillingUI} from 'getsentry/utils/billing';

type Props = {
  children: React.ReactNode;
};

export default function SubscriptionSettingsLayout(props: Props) {
  const organization = useOrganization();
  const isNewBillingUI = hasNewBillingUI(organization);

  const location = useLocation();
  const params = useParams();
  const routes = useRoutes();
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
    return <SettingsLayout>{children}</SettingsLayout>;
  }

  return (
    <SettingsColumn direction="column" flex={1} minWidth="0">
      <StyledSettingsHeader>
        <Flex align="center" justify="between" gap="xl">
          <StyledSettingsBreadcrumb params={params} routes={routes} />
          <Flex align="center" gap="xl">
            <FeedbackButton
              feedbackOptions={{
                formTitle: t('Give feedback'),
                messagePlaceholder: t(
                  'How can we make the %s page better for you?',
                  feedbackSource
                ),
                tags: {
                  ['feedback.source']: feedbackSource,
                  ['feedback.owner']: 'billing',
                },
              }}
            />
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
