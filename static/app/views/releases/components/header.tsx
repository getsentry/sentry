import type {Location} from 'history';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {TabList} from 'sentry/components/core/tabs';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  activeDataset: 'mobile-builds' | 'releases';
  mobileBuildsDatasetQuery: Location['query'];
  pathname: string;
  releasesDatasetQuery: Location['query'];
  shouldShowMobileBuildsTab: boolean;
};

export default function Header({
  activeDataset,
  shouldShowMobileBuildsTab,
  releasesDatasetQuery,
  mobileBuildsDatasetQuery,
  pathname,
}: Props) {
  const organization = useOrganization();
  return (
    <Layout.Header noActionWrap unified={!shouldShowMobileBuildsTab}>
      <Layout.HeaderContent unified>
        <Layout.Title>
          {t('Releases')}
          <PageHeadingQuestionTooltip
            docsUrl="https://docs.sentry.io/product/releases/"
            title={t(
              'A visualization of your release adoption from the past 24 hours, providing a high-level view of the adoption stage, percentage of crash-free users and sessions, and more.'
            )}
          />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <FeedbackButton
          feedbackOptions={{
            messagePlaceholder: t('How can we improve the Releases experience?'),
            tags: {
              ['feedback.source']: 'releases-list-header',
            },
          }}
        />
      </Layout.HeaderActions>
      {shouldShowMobileBuildsTab ? (
        <Layout.HeaderTabs
          value={activeDataset}
          onChange={key => {
            if (key === 'mobile-builds') {
              trackAnalytics('preprod.releases.mobile-builds.tab-clicked', {
                organization,
              });
            }
          }}
        >
          <TabList aria-label={t('Releases dataset selector')}>
            <TabList.Item
              key="releases"
              to={{pathname, query: releasesDatasetQuery}}
              textValue={t('Releases')}
            >
              {t('Releases')}
            </TabList.Item>
            <TabList.Item
              key="mobile-builds"
              to={{pathname, query: mobileBuildsDatasetQuery}}
              textValue={t('Mobile Builds')}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: space(0.5),
                }}
              >
                {t('Mobile Builds')}
                <FeatureBadge type="beta" />
              </span>
            </TabList.Item>
          </TabList>
        </Layout.HeaderTabs>
      ) : null}
    </Layout.Header>
  );
}
