import {Fragment} from 'react';

import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {ISSUE_TAXONOMY_CONFIG} from 'sentry/views/issueList/taxonomies';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {IssueViews} from './issueViews/issueViews';

function IssuesSecondaryNavigationImpl() {
  const settingsV3 = useSettingsV3();
  const organization = useOrganization();
  const baseUrl = `/organizations/${organization.slug}/issues`;
  const hasIssueInbox = organization.features.includes('issue-inbox');
  const hasSeerNightShift = organization.features.includes('seer-night-shift-ui');
  const hasAutofixSection = hasSeerNightShift || !hasIssueInbox;

  const visibleIssueTypes = Object.values(ISSUE_TAXONOMY_CONFIG).filter(
    ({featureFlags}) =>
      !featureFlags ||
      featureFlags.some(feature => organization.features.includes(feature))
  );

  useLLMContext({
    contextHint:
      'The Issues secondary nav panel — feed, issue type shortcuts (each ' +
      "may carry a beta/new/alpha badge), and the user's starred issue views " +
      '(a nested "issues-starred-views" node holds those, each with its own ' +
      'live issue count as a further-nested child).',
    hasAutofixSection,
    hasAutofixOverview: hasSeerNightShift,
    issueTypes: visibleIssueTypes.map(({key, label, badge}) => ({key, label, badge})),
  });

  return (
    <Fragment>
      <SecondaryNavigation.Header>
        <SecondaryNavigation.HeaderTitle>{t('Issues')}</SecondaryNavigation.HeaderTitle>
      </SecondaryNavigation.Header>
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
            {visibleIssueTypes.map(({key, label, badge}) => (
              <SecondaryNavigation.ListItem key={key}>
                <SecondaryNavigation.Link
                  to={`${baseUrl}/${key}/`}
                  end
                  analyticsItemName={`issues_types_${key}`}
                  leadingItems={
                    settingsV3 && badge ? (
                      <SecondaryNavigation.FeatureBadge type={badge} />
                    ) : null
                  }
                  trailingItems={
                    !settingsV3 && badge ? (
                      <SecondaryNavigation.FeatureBadge type={badge} />
                    ) : null
                  }
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
                      leadingItems={
                        settingsV3 ? (
                          <SecondaryNavigation.FeatureBadge type="new" />
                        ) : null
                      }
                      trailingItems={
                        settingsV3 ? null : (
                          <SecondaryNavigation.FeatureBadge type="new" />
                        )
                      }
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
