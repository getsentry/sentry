import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {TabList} from 'sentry/components/core/tabs';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  activeDataset: 'releases' | 'mobile-builds';
  mobileBuildsDatasetQuery: Record<string, any>;
  pathname: string;
  releasesDatasetQuery: Record<string, any>;
  shouldShowMobileBuildsTab: boolean;
};

export default function Header({
  activeDataset,
  mobileBuildsDatasetQuery,
  pathname,
  releasesDatasetQuery,
  shouldShowMobileBuildsTab,
}: Props) {
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
      <Container paddingTop="xl">
        <ReleasesPageFilterBar condensed>
          <ProjectPageFilter />
          <EnvironmentPageFilter />
          <DatePageFilter
            disallowArbitraryRelativeRanges
            menuFooterMessage={t(
              'Changing this date range will recalculate the release metrics. Select a supported date range from the options above.'
            )}
          />
        </ReleasesPageFilterBar>
        {shouldShowMobileBuildsTab ? (
          <Container paddingTop="xl">
            <Layout.HeaderTabs
              value={activeDataset}
              aria-label={t('Releases dataset selector')}
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
          </Container>
        ) : null}
      </Container>
    </Layout.Header>
  );
}

const ReleasesPageFilterBar = styled(PageFilterBar)`
  grid-column: 1 / -1;
`;
