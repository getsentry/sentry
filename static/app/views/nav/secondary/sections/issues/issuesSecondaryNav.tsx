import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
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
          <SecondaryNav.Section id="issues-feed">
            <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="issues_feed">
              {t('Feed')}
            </SecondaryNav.Item>
            <SecondaryNav.Item
              to={`${baseUrl}/feedback/`}
              analyticsItemName="issues_feedback"
            >
              {t('User Feedback')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        )}
        {hasIssueTaxonomy && (
          <Fragment>
            <SecondaryNav.Section id="issues-feed">
              <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="issues_feed">
                {t('Feed')}
              </SecondaryNav.Item>
            </SecondaryNav.Section>
            <SecondaryNav.Section id="issues-types">
              {Object.values(ISSUE_TAXONOMY_CONFIG).map(({key, label}) => (
                <SecondaryNav.Item
                  key={key}
                  to={`${baseUrl}/${key}/`}
                  end
                  analyticsItemName={`issues_types_${key}`}
                >
                  {label}
                </SecondaryNav.Item>
              ))}
              <SecondaryNav.Item
                to={`${baseUrl}/feedback/`}
                analyticsItemName="issues_feedback"
              >
                {t('User Feedback')}
              </SecondaryNav.Item>
            </SecondaryNav.Section>
          </Fragment>
        )}
        {organization.features.includes('enforce-stacked-navigation') && (
          <SecondaryNav.Section id="issues-views-all">
            <SecondaryNav.Item to={`${baseUrl}/views/`} end>
              {t('All Views')}
            </SecondaryNav.Item>
          </SecondaryNav.Section>
        )}
        {organization.features.includes('issue-stream-custom-views') && (
          <IssueViewNavItems sectionRef={sectionRef} />
        )}
        <ConfigureSection baseUrl={baseUrl} />
      </SecondaryNav.Body>
    </SecondaryNav>
  );
}

function ConfigureSection({baseUrl}: {baseUrl: string}) {
  const hasWorkflowEngine = useWorkflowEngineFeatureGate();
  return (
    <StickyBottomSection id="issues-configure" title={t('Configure')}>
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
    </StickyBottomSection>
  );
}

const StickyBottomSection = styled(SecondaryNav.Section)`
  position: sticky;
  bottom: 0;
  background: ${p => (p.theme.isChonk ? p.theme.background : p.theme.surface200)};
`;
