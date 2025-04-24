import {Fragment, useRef} from 'react';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {IssueViewNavItems} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavItems';
import {PrimaryNavGroup} from 'sentry/views/nav/types';

export function IssuesSecondaryNav() {
  const organization = useOrganization();
  const sectionRef = useRef<HTMLDivElement>(null);
  const baseUrl = `/organizations/${organization.slug}/issues`;

  const hasIssueTaxonomy = organization.features.includes('issue-taxonomy');

  return (
    <SecondaryNav>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.ISSUES].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        {!hasIssueTaxonomy && (
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
        )}
        {hasIssueTaxonomy && (
          <SecondaryNav.Section>
            <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="issues_feed">
              {t('Feed')}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              to={`${baseUrl}/errors-outages/`}
              end
              analyticsItemName="issues_types_errors_outages"
            >
              {t('Errors & Outages')}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              to={`${baseUrl}/metrics/`}
              end
              analyticsItemName="issues_types_metrics"
            >
              {t('Metrics')}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              to={`${baseUrl}/code-smell/`}
              end
              analyticsItemName="issues_types_code_smell"
            >
              {t('Code Smell')}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              to={`${baseUrl}/feedback/`}
              analyticsItemName="issues_feedback"
            >
              {t('Feedback')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        )}
        {organization.features.includes('issue-stream-custom-views') && (
          <IssueViewNavItems sectionRef={sectionRef} baseUrl={baseUrl} />
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
