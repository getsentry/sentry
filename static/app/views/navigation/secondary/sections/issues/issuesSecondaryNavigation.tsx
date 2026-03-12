import {Fragment, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeMonitorBasePathname} from 'sentry/views/detectors/pathnames';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {useNavigationContext} from 'sentry/views/navigation/navigationContext';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';
import {NavigationLayout} from 'sentry/views/navigation/types';

export function IssuesSecondaryNavigation() {
  const organization = useOrganization();
  const sectionRef = useRef<HTMLDivElement>(null);
  const baseUrl = `/organizations/${organization.slug}/issues`;
  return (
    <Fragment>
      <SecondaryNavigation.Header>{t('Issues')}</SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        <SecondaryNavigation.Section id="issues-feed">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/`}
                end
                analyticsItemName="issues_feed"
              >
                {t('Feed')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Section id="issues-types">
          <SecondaryNavigation.List>
            {Object.values(ISSUE_TAXONOMY_CONFIG).map(({key, label}) => (
              <SecondaryNavigation.ListItem key={key}>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/${key}/`}
                  end
                  analyticsItemName={`issues_types_${key}`}
                >
                  {label}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            ))}
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/feedback/`}
                analyticsItemName="issues_feedback"
              >
                {t('User Feedback')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
            {organization.features.includes('seer-autopilot') && (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/instrumentation/`}
                  analyticsItemName="issues_instrumentation"
                >
                  {t('Instrumentation')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            )}
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Section id="issues-views-all">
          <SecondaryNavigation.List>
            <SecondaryNavigation.ListItem>
              <SecondaryNavigation.Link
                to={`${baseUrl}/views/`}
                analyticsItemName="issues_all_views"
                end
              >
                {t('All Views')}
              </SecondaryNavigation.Link>
            </SecondaryNavigation.ListItem>
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <IssueViews sectionRef={sectionRef} />
        <ConfigureSection baseUrl={baseUrl} />
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

function ConfigureSection({baseUrl}: {baseUrl: string}) {
  const organization = useOrganization();
  const {layout} = useNavigationContext();
  const isSticky = layout === NavigationLayout.SIDEBAR;

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
      <SecondaryNavigation.List>
        <SecondaryNavigation.ListItem>
          <SecondaryNavigation.Link
            to={alertsLink}
            {...(!shouldRedirectToWorkflowEngineUI && {activeTo: `${baseUrl}/alerts/`})}
            analyticsItemName="issues_alerts"
          >
            {t('Alerts')}
          </SecondaryNavigation.Link>
        </SecondaryNavigation.ListItem>
      </SecondaryNavigation.List>
    </StickyBottomSection>
  );
}

const StickyBottomSection = styled(SecondaryNavigation.Section, {
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
