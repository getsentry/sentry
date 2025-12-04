import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';

export default function Header() {
  return (
    <Layout.Header noActionWrap unified>
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
      </Container>
    </Layout.Header>
  );
}

const ReleasesPageFilterBar = styled(PageFilterBar)`
  grid-column: 1 / -1;
`;
