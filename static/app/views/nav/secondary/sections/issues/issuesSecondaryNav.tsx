import {Fragment, useEffect, useRef} from 'react';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import type {IssueView} from 'sentry/views/issueList/issueViews/issueViews';
import {useFetchGroupSearchViews} from 'sentry/views/issueList/queries/useFetchGroupSearchViews';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {IssueViewNavItems} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItems';
import {useUpdateGroupSearchViewLastVisited} from 'sentry/views/nav/secondary/sections/issues/issueViews/useUpdateGroupSearchViewLastVisited';

export function IssuesSecondaryNav() {
  const organization = useOrganization();

  const sectionRef = useRef<HTMLDivElement>(null);
  const {viewId} = useParams<{viewId?: string}>();

  const {data: groupSearchViews} = useFetchGroupSearchViews({
    orgSlug: organization.slug,
  });
  const {mutate: updateViewLastVisited} = useUpdateGroupSearchViewLastVisited();

  useEffect(() => {
    if (groupSearchViews && viewId) {
      const view = groupSearchViews.find(v => v.id === viewId);
      if (view) {
        updateViewLastVisited({viewId: view.id});
      }
    }
  }, [groupSearchViews, viewId, updateViewLastVisited]);

  const baseUrl = `/organizations/${organization.slug}/issues`;

  return (
    <SecondaryNav>
      <SecondaryNav.Header>{t('Issues')}</SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section>
          <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="issues_feed">
            {t('Feed')}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            to={`${baseUrl}/feedback/`}
            analyticsItemName="issues_feedback"
          >
            {t('Feedback')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        {groupSearchViews && (
          <IssueViewNavItems
            loadedViews={groupSearchViews.map(
              (
                {
                  id,
                  name,
                  query: viewQuery,
                  querySort: viewQuerySort,
                  environments: viewEnvironments,
                  projects: viewProjects,
                  timeFilters: viewTimeFilters,
                },
                index
              ): IssueView => {
                const tabId = id ?? `default${index.toString()}`;

                return {
                  id: tabId,
                  key: tabId,
                  label: name,
                  query: viewQuery,
                  querySort: viewQuerySort,
                  environments: viewEnvironments,
                  projects: viewProjects,
                  timeFilters: viewTimeFilters,
                  isCommitted: true,
                };
              }
            )}
            sectionRef={sectionRef}
            baseUrl={baseUrl}
          />
        )}
        <ConfigureSection baseUrl={baseUrl} />
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}

function ConfigureSection({baseUrl}: {baseUrl: string}) {
  const hasWorkflowEngine = useWorkflowEngineFeatureGate();
  return (
    <SecondaryNav.Section title={t('Configure')}>
      {hasWorkflowEngine ? (
        <Fragment>
          <SecondaryNav.Item
            trailingItems={<FeatureBadge type="alpha" variant="short" />}
            to={`${baseUrl}/monitors/`}
            activeTo={`${baseUrl}/monitors`}
          >
            {t('Monitors')}
          </SecondaryNav.Item>
          <SecondaryNav.Item
            trailingItems={<FeatureBadge type="alpha" variant="short" />}
            to={`${baseUrl}/automations/`}
            activeTo={`${baseUrl}/automations`}
          >
            {t('Automations')}
          </SecondaryNav.Item>
        </Fragment>
      ) : (
        <SecondaryNav.Item
          to={`${baseUrl}/alerts/rules/`}
          activeTo={`${baseUrl}/alerts/`}
          analyticsItemName="issues_alerts"
        >
          {t('Alerts')}
        </SecondaryNav.Item>
      )}
    </SecondaryNav.Section>
  );
}
