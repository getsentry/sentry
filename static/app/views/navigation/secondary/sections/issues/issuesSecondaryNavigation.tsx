import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {t} from 'sentry/locale';
import {orgHasSeerAccess} from 'sentry/utils/seer/orgHasSeerAccess';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useInboxIssueCount} from 'sentry/views/issueList/queries/useInboxIssueCount';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {IssueCount} from 'sentry/views/navigation/secondary/sections/issues/issueCount';
import {IssueViews} from 'sentry/views/navigation/secondary/sections/issues/issueViews/issueViews';

function InboxCountBadge() {
  const {data: count} = useInboxIssueCount();

  return count === undefined ? null : <IssueCount count={count} />;
}

export function IssuesSecondaryNavigation() {
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/issues`;
  const hasIssueInbox = organization.features.includes('issue-inbox');
  const hasInbox = hasIssueInbox && orgHasSeerAccess(organization);
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
            {Object.values(ISSUE_TAXONOMY_CONFIG)
              .filter(
                ({featureFlags}) =>
                  !featureFlags ||
                  featureFlags.some(feature => organization.features.includes(feature))
              )
              .map(({key, label, badge}) => (
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
        {!hasIssueInbox && (
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
      </SecondaryNavigation.Body>
    </Fragment>
  );
}
