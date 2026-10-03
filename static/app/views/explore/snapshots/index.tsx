import {Fragment, useMemo} from 'react';

import {Container, Stack} from '@sentry/scraps/layout';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {DatePageFilter} from 'sentry/components/pageFilters/date/datePageFilter';
import {PageFilterBar} from 'sentry/components/pageFilters/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/pageFilters/project/projectPageFilter';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {PreprodBuildsDisplay} from 'sentry/components/preprod/preprodBuildsDisplay';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ExploreBodyContent,
  ExploreBodySearch,
  ExploreContentSection,
} from 'sentry/views/explore/components/styles';
import {
  getSelectedBuildProjectIds,
  MobileBuilds,
} from 'sentry/views/explore/releases/list/mobileBuilds';
import {TopBar} from 'sentry/views/navigation/topBar';
import {useLLMContext} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';
import {
  toLLMContextProjectFields,
  useSelectedProjectsForLLMContext,
} from 'sentry/views/seerExplorer/utils/selectedProjectsForLLMContext';

const snapshotsFeedbackOptions = {
  messagePlaceholder: t('How can we improve the Snapshots experience?'),
  tags: {
    'feedback.source': 'snapshots-list-header',
  },
};

function SnapshotsListPage() {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();

  const selectedProjectIds = useMemo(
    () => getSelectedBuildProjectIds(selection.projects),
    [selection.projects]
  );

  const selectedProjects = useSelectedProjectsForLLMContext();

  useLLMContext({
    contextHint:
      'Sentry snapshots list page. Shows uploaded snapshot builds (sets of UI screenshots) and how each compares to its base build: images added, changed, removed, and approval status. ' +
      'Users can search and filter by project and date, and open a snapshot to review image diffs. ' +
      'projectSelectionInstruction describes the page-filter project scope (explicit pins vs My/All Projects). ' +
      'When projectIds/projectSlugs are empty, that is expected for My/All Projects — follow projectSelectionInstruction.',
    searchQuery: decodeScalar(location.query.query) ?? '',
    currentSelectedDateRange: selection.datetime,
    ...toLLMContextProjectFields(selectedProjects),
  });

  return (
    <PageFiltersContainer showAbsolute={false}>
      <SentryDocumentTitle title={t('Snapshots')} orgSlug={organization.slug} />
      <Stack flex={1}>
        <NoProjectMessage organization={organization}>
          <SnapshotsHeader />
          <Container paddingBottom="0">
            {containerProps => (
              <ExploreBodySearch {...containerProps}>
                <Layout.Main width="full">
                  <Container width={{zero: '100%', md: 'max-content'}}>
                    {filterBarProps => (
                      <PageFilterBar {...filterBarProps} condensed>
                        <ProjectPageFilter />
                        <DatePageFilter />
                      </PageFilterBar>
                    )}
                  </Container>
                </Layout.Main>
              </ExploreBodySearch>
            )}
          </Container>
          <ExploreBodyContent>
            <ExploreContentSection gap="xl">
              <MobileBuilds
                organization={organization}
                selectedProjectIds={selectedProjectIds}
                defaultDisplay={PreprodBuildsDisplay.SNAPSHOT}
                hideDisplayToggle
              />
            </ExploreContentSection>
          </ExploreBodyContent>
        </NoProjectMessage>
      </Stack>
    </PageFiltersContainer>
  );
}

function SnapshotsHeader() {
  return (
    <Fragment>
      <TopBar.Slot name="title">
        {t('Snapshots')}
        <PageHeadingQuestionTooltip
          docsUrl="https://docs.sentry.io/product/snapshots/"
          title={t(
            'Visual snapshots of your app uploaded from CI, compared against a base build so you can review UI changes before they ship.'
          )}
        />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          feedbackOptions={snapshotsFeedbackOptions}
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}

export default registerLLMContext('snapshots-list', SnapshotsListPage);
