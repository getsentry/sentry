import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import {orgHasIssueInbox} from 'sentry/utils/seer/orgHasIssueInbox';
import {orgHasSeerAccess} from 'sentry/utils/seer/orgHasSeerAccess';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useInboxIssueCount} from 'sentry/views/issueList/pages/inbox/useInboxIssueCount';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueCount} from 'sentry/views/navigation/secondary/sections/issues/issueCount';
import {IssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

function InboxCountBadgeImpl() {
  const {data: count} = useInboxIssueCount();

  // Only mounted when the Inbox link itself is shown, so this is the one
  // place that knows the live count without firing the request for every
  // user regardless of Inbox access. Registered as its own node (rather than
  // writing into the parent section's data) so it doesn't clobber the
  // section-level useLLMContext call above it.
  useLLMContext({
    contextHint: 'The live issue count shown on the Issues nav Inbox link.',
    inboxCount: count ?? null,
  });

  return count === undefined ? null : <IssueCount count={count} />;
}

const InboxCountBadge = registerLLMContext('navigation', InboxCountBadgeImpl);

function IssuesSecondaryNavigationImpl() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/issues`;
  const hasIssueInbox = orgHasIssueInbox(organization);
  const hasInbox = hasIssueInbox && orgHasSeerAccess(organization);
  const hasSeerNightShift = organization.features.includes('seer-night-shift-ui');
  const hasAutofixSection = hasSeerNightShift || !hasIssueInbox;

  const visibleIssueTypes = Object.values(ISSUE_TAXONOMY_CONFIG).filter(
    ({featureFlags}) =>
      !featureFlags ||
      featureFlags.some(feature => organization.features.includes(feature))
  );

  useLLMContext({
    contextHint:
      'The Issues secondary nav panel — feed/inbox, issue type shortcuts (each ' +
      "may carry a beta/new/alpha badge), and the user's starred issue views " +
      '(a nested "issues-starred-views" node holds those, each with its own ' +
      'live issue count as a further-nested child). When present, a nested ' +
      '"Inbox" child node reports the live inbox count.',
    hasInbox,
    hasAutofixSection,
    hasAutofixOverview: hasSeerNightShift,
    issueTypes: visibleIssueTypes.map(({key, label, badge}) => ({key, label, badge})),
  });

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
            {hasInbox && (
              <SecondaryNavigation.ListItem>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/inbox/`}
                  end
                  analyticsItemName="issues_inbox"
                  trailingItems={
                    <Fragment>
                      <InboxCountBadge />
                      <FeatureBadge type="new" />
                    </Fragment>
                  }
                >
                  {t('Inbox')}
                </SecondaryNavigation.Link>
              </SecondaryNavigation.ListItem>
            )}
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        <SecondaryNavigation.Separator />
        <SecondaryNavigation.Section id="issues-types">
          <SecondaryNavigation.List>
            {visibleIssueTypes.map(({key, label, badge}) => (
              <SecondaryNavigation.ListItem key={key}>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/${key}/`}
                  end
                  analyticsItemName={`issues_types_${key}`}
                  trailingItems={badge ? <FeatureBadge type={badge} /> : null}
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
          </SecondaryNavigation.List>
        </SecondaryNavigation.Section>
        {(hasSeerNightShift || !hasIssueInbox) && (
          <Fragment>
            <SecondaryNavigation.Separator />
            <SecondaryNavigation.Section id="issues-autofix" title={t('Autofix')}>
              <SecondaryNavigation.List>
                {hasSeerNightShift && (
                  <SecondaryNavigation.ListItem>
                    <SecondaryNavigation.Link
                      to={`${baseUrl}/autofix/`}
                      analyticsItemName="issues_autofix_overview"
                      end
                      trailingItems={<FeatureBadge type="new" />}
                    >
                      {t('Overview')}
                    </SecondaryNavigation.Link>
                  </SecondaryNavigation.ListItem>
                )}
                {!hasIssueInbox && (
                  <SecondaryNavigation.ListItem>
                    <SecondaryNavigation.Link
                      to={`${baseUrl}/autofix/recent/`}
                      analyticsItemName="issues_autofix"
                      end
                    >
                      {t('Recently Run')}
                    </SecondaryNavigation.Link>
                  </SecondaryNavigation.ListItem>
                )}
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
      </SecondaryNavigation.Body>
    </Fragment>
  );
}

export const IssuesSecondaryNavigation = registerLLMContext(
  'navigation',
  IssuesSecondaryNavigationImpl
);
