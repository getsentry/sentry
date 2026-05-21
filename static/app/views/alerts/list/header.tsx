import {LinkButton} from '@sentry/scraps/button';
import {TabList} from '@sentry/scraps/tabs';

import {navigateTo} from 'sentry/actionCreators/navigation';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

type Props = {
  activeTab: 'stream' | 'rules';
};

export function AlertHeader({activeTab}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  const handleNavigateToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateTo(
      `/settings/${organization.slug}/projects/:projectId/alerts/`,
      navigate,
      location
    );
  };

  const alertRulesLink = (
    <TabList.Item
      key="rules"
      to={makeAlertsPathname({
        path: '/rules/',
        organization,
      })}
    >
      {t('Alert Rules')}
    </TabList.Item>
  );

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Layout.Title>
          {t('Alerts')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/alerts/"
            title={t(
              'Real-time visibility into problems with your code and the impact on your users, along with a view of your existing alert rules, their status, project, team, and creation date.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      <TopBar.Slot name="actions">
        <LinkButton
          onClick={handleNavigateToSettings}
          href="#"
          icon={<IconSettings size="sm" />}
          tooltipProps={{title: t('Settings')}}
          aria-label={t('Settings')}
        />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
      <Layout.HeaderTabs value={activeTab}>
        <TabList>
          {alertRulesLink}
          <TabList.Item
            key="stream"
            to={makeAlertsPathname({
              path: '/',
              organization,
            })}
          >
            {t('History')}
          </TabList.Item>
        </TabList>
      </Layout.HeaderTabs>
    </Layout.Header>
  );
}
