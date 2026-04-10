import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t, tct} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';

export function IssuesSecondaryNavigation() {
  const organization = useOrganization();
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
        <SecondaryNavigation.Separator />
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
        {organization.features.includes('seer-issue-view') && (
          <Fragment>
            <SecondaryNavigation.Separator />
            <SecondaryNavigation.Section id="issues-autofix" title={t('Autofix')}>
              <SecondaryNavigation.List>
                <SecondaryNavigation.ListItem>
                  <SecondaryNavigation.Link
                    to={`${baseUrl}/autofix/recent/`}
                    analyticsItemName="issues_autofix"
                    end
                  >
                    {t('Recently Run')}
                  </SecondaryNavigation.Link>
                </SecondaryNavigation.ListItem>
              </SecondaryNavigation.List>
            </SecondaryNavigation.Section>
          </Fragment>
        )}
        <SecondaryNavigation.Separator />
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
        <IssueViews />
        <ConfigureSection baseUrl={baseUrl} />
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

function ConfigureSection({baseUrl}: {baseUrl: string}) {
  const organization = useOrganization();
  const {layout} = usePrimaryNavigation();
  const isSticky = layout === 'sidebar';

  const hasWorkflowEngineUI = organization.features.includes('workflow-engine-ui');
  const hasRedirectOptOut = organization.features.includes(
    'workflow-engine-redirect-opt-out'
  );
  const shouldRedirectToWorkflowEngineUI = !hasRedirectOptOut && hasWorkflowEngineUI;

  const alertsLink = shouldRedirectToWorkflowEngineUI
    ? `${makeAutomationBasePathname(organization.slug)}?alertsRedirect=true`
    : `${baseUrl}/alerts/rules/`;

  return (
    <Fragment>
      <SecondaryNavigation.Separator />
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
              trailingItems={
                hasWorkflowEngineUI ? (
                  <Tooltip
                    isHoverable
                    title={
                      <Fragment>
                        <Text as="p">{t('Alerts now live under Monitors.')}</Text>
                        <Text as="p">
                          {tct('See the [link:new Alerts page here.]', {
                            link: (
                              <Link
                                to={`/organizations/${organization.slug}/monitors/alerts/`}
                              />
                            ),
                          })}
                        </Text>
                      </Fragment>
                    }
                  >
                    <Badge variant="muted">{t('Moved')}</Badge>
                  </Tooltip>
                ) : null
              }
            >
              {t('Alerts')}
            </SecondaryNavigation.Link>
          </SecondaryNavigation.ListItem>
        </SecondaryNavigation.List>
      </StickyBottomSection>
    </Fragment>
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
