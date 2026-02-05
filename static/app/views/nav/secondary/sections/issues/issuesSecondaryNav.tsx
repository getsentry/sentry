import {Fragment, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useNavContext} from 'sentry/views/nav/context';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {SecondaryNav} from 'sentry/views/nav/secondary/secondary';
import {IssueViews} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViews';
import {NavLayout, PrimaryNavGroup} from 'sentry/views/nav/types';

export function IssuesSecondaryNav() {
  const organization = useOrganization();
  const sectionRef = useRef<HTMLDivElement>(null);
  const baseUrl = `/organizations/${organization.slug}/issues`;
  const hasTopIssuesUI = organization.features.includes('top-issues-ui');

  return (
    <Fragment>
      <SecondaryNav.Header>
        {PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.ISSUES].label}
      </SecondaryNav.Header>
      <SecondaryNav.Body>
        <SecondaryNav.Section id="issues-feed">
          <SecondaryNav.Item to={`${baseUrl}/`} end analyticsItemName="issues_feed">
            {t('Feed')}
          </SecondaryNav.Item>
          {hasTopIssuesUI && (
            <SecondaryNav.Item
              to={`${baseUrl}/dynamic-groups/`}
              analyticsItemName="issues_dynamic_groups"
            >
              {t('Top Issues')}
            </SecondaryNav.Item>
          )}
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
          {organization.features.includes('seer-autopilot') && (
            <SecondaryNav.Item
              to={`${baseUrl}/instrumentation/`}
              analyticsItemName="issues_instrumentation"
            >
              {t('Instrumentation')}
            </SecondaryNav.Item>
          )}
        </SecondaryNav.Section>
        <SecondaryNav.Section id="issues-views-all">
          <SecondaryNav.Item
            to={`${baseUrl}/views/`}
            analyticsItemName="issues_all_views"
            end
          >
            {t('All Views')}
          </SecondaryNav.Item>
        </SecondaryNav.Section>
        <IssueViews sectionRef={sectionRef} />
        <ConfigureSection baseUrl={baseUrl} />
      </SecondaryNav.Body>
    </Fragment>
  );
}

function ConfigureSection({baseUrl}: {baseUrl: string}) {
  const organization = useOrganization();
  const {layout} = useNavContext();
  const isSticky = layout === NavLayout.SIDEBAR;

  const hasRedirectOptOut = organization.features.includes(
    'workflow-engine-redirect-opt-out'
  );
  const shouldRedirectToWorkflowEngineUI =
    !hasRedirectOptOut && organization.features.includes('workflow-engine-ui');

  const alertsLink = shouldRedirectToWorkflowEngineUI
    ? `${makeMonitorBasePathname(organization.slug)}?alertsRedirect=true`
    : `${baseUrl}/alerts/rules/`;

  return (
    <StickyBottomSection
      id="issues-configure"
      title={t('Configure')}
      collapsible={false}
      isSticky={isSticky}
    >
      <SecondaryNav.Item
        to={alertsLink}
        {...(!shouldRedirectToWorkflowEngineUI && {activeTo: `${baseUrl}/alerts/`})}
        analyticsItemName="issues_alerts"
      >
        {t('Alerts')}
      </SecondaryNav.Item>
    </StickyBottomSection>
  );
}

const StickyBottomSection = styled(SecondaryNav.Section, {
  shouldForwardProp: prop => prop !== 'isSticky',
})<{isSticky: boolean}>`
  ${p =>
    p.isSticky &&
    css`
      position: sticky;
      bottom: 0;
      z-index: 1;
      background: ${p.theme.tokens.background.secondary};
    `}
`;
