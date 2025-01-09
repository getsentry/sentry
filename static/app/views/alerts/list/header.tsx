import {navigateTo} from 'sentry/actionCreators/navigation';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import CreateAlertButton from 'sentry/components/createAlertButton';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {TabList} from 'sentry/components/tabs';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  activeTab: 'stream' | 'rules';
  router: InjectedRouter;
};

function AlertHeader({router, activeTab}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  /**
   * Incidents list is currently at the organization level, but the link needs to
   * go down to a specific project scope.
   */
  const handleNavigateToSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    navigateTo(`/settings/${organization.slug}/projects/:projectId/alerts/`, router);
  };

  const alertRulesLink = (
    <TabList.Item
      key="rules"
      to={normalizeUrl(`/organizations/${organization.slug}/alerts/rules/`)}
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
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <CreateAlertButton
            organization={organization}
            iconProps={{size: 'sm'}}
            size="sm"
            priority="primary"
            referrer="alert_stream"
            showPermissionGuide
            projectSlug={
              selection.projects.length === 1
                ? ProjectsStore.getById(`${selection.projects[0]}`)?.slug
                : undefined
            }
          >
            {t('Create Alert')}
          </CreateAlertButton>
          <FeedbackWidgetButton />
          <LinkButton
            size="sm"
            onClick={handleNavigateToSettings}
            href="#"
            icon={<IconSettings size="sm" />}
            aria-label={t('Settings')}
          />
        </ButtonBar>
      </Layout.HeaderActions>
      <Layout.HeaderTabs value={activeTab}>
        <TabList hideBorder>
          {alertRulesLink}
          <TabList.Item
            key="stream"
            to={normalizeUrl(`/organizations/${organization.slug}/alerts/`)}
          >
            {t('History')}
          </TabList.Item>
        </TabList>
      </Layout.HeaderTabs>
    </Layout.Header>
  );
}

export default AlertHeader;
