import {Fragment, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Button} from 'sentry/components/core/button';
import {Stack} from 'sentry/components/core/layout';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackFilters from 'sentry/components/feedback/feedbackFilters';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import FeedbackSearch from 'sentry/components/feedback/feedbackSearch';
import FeedbackSetupPanel from 'sentry/components/feedback/feedbackSetupPanel';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import FeedbackSummaryCategories from 'sentry/components/feedback/summaryCategories/feedbackSummaryCategories';
import useCurrentFeedbackId from 'sentry/components/feedback/useCurrentFeedbackId';
import useHaveSelectedProjectsSetupFeedback from 'sentry/components/feedback/useFeedbackOnboarding';
import {FeedbackQueryKeys} from 'sentry/components/feedback/useFeedbackQueryKeys';
import useRedirectToFeedbackFromEvent from 'sentry/components/feedback/useRedirectToFeedbackFromEvent';
import FeedbackButton from 'sentry/components/feedbackButton/feedbackButton';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export default function FeedbackListPage() {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();
  const pageFilters = usePageFilters();

  const feedbackId = useCurrentFeedbackId();
  const hasSlug = Boolean(feedbackId);

  const {query: locationQuery} = useLocation();
  const searchQuery = locationQuery.query ?? '';

  useRedirectToFeedbackFromEvent();

  const theme = useTheme();
  const isMediumOrSmaller = useMedia(`(max-width: ${theme.breakpoints.md})`);
  const [showItemPreview, setShowItemPreview] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // show feedback item preview when feedback is selected on med screens and smaller
  useEffect(() => {
    if (isMediumOrSmaller) {
      setShowItemPreview(Boolean(feedbackId));
      if (feedbackId) {
        window.scrollTo(0, 0);
      }
    } else {
      setShowItemPreview(false);
    }
  }, [isMediumOrSmaller, feedbackId]);

  useEffect(() => {
    setSelectedItemIndex(null);
  }, [pageFilters, searchQuery]);

  const handleJumpToSelectedItem = () => {
    const scrollContainer = document.querySelector('[data-scrollable]');
    if (selectedItemIndex === null || !scrollContainer) {
      return;
    }

    const estimatedItemHeight = 80;
    const scrollPosition = selectedItemIndex * estimatedItemHeight;

    scrollContainer.scrollTo({
      top: scrollPosition,
      behavior: 'auto',
    });
  };

  const handleBackToList = () => {
    setShowItemPreview(false);
  };

  const handleItemSelect = (itemIndex?: number) => {
    setSelectedItemIndex(itemIndex ?? null);
    setShowItemPreview(true);
  };

  const largeScreenView = (
    <Fragment>
      <Stack style={{gridArea: 'list'}} gap="md">
        <FeedbackSummaryCategories />
        <Container>
          <FeedbackList onItemSelect={() => {}} />
        </Container>
      </Stack>

      <Container style={{gridArea: 'details'}}>
        <AnalyticsArea name="details">
          <FeedbackItemLoader />
        </AnalyticsArea>
      </Container>
    </Fragment>
  );

  const smallerScreenView = (
    <Fragment>
      {showItemPreview ? (
        <Container style={{gridArea: 'content'}}>
          <AnalyticsArea name="details">
            <FeedbackItemLoader onBackToList={handleBackToList} />
          </AnalyticsArea>
        </Container>
      ) : (
        <Stack style={{gridArea: 'content'}} gap="md">
          <FeedbackSummaryCategories />
          <Container>
            <FeedbackList onItemSelect={handleItemSelect} />
            {selectedItemIndex !== null && (
              <JumpToSelectedButton size="xs" onClick={handleJumpToSelectedItem}>
                {t('Jump to selected item')}
              </JumpToSelectedButton>
            )}
          </Container>
        </Stack>
      )}
    </Fragment>
  );

  // on medium and smaller screens, hide the search & filters when feedback item is in view
  const hideTop = isMediumOrSmaller && showItemPreview;

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <FullViewport>
        <FeedbackQueryKeys organization={organization}>
          <Layout.Header unified>
            <Layout.HeaderContent unified>
              <Layout.Title>
                {t('User Feedback')}
                <PageHeadingQuestionTooltip
                  title={t(
                    'The User Feedback Widget allows users to submit feedback quickly and easily any time they encounter something that isn’t working as expected.'
                  )}
                  docsUrl="https://docs.sentry.io/product/user-feedback/"
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <FeedbackButton
                size="sm"
                feedbackOptions={{
                  messagePlaceholder: t(
                    'How can we improve the User Feedback experience?'
                  ),
                  tags: {
                    ['feedback.source']: 'feedback-list',
                  },
                }}
              />
            </Layout.HeaderActions>
          </Layout.Header>
          <PageFiltersContainer>
            <ErrorBoundary>
              <Stack align="stretch" gap="xl" background="primary" overflow="hidden">
                <LayoutGrid hideTop={hideTop}>
                  {!hideTop && (
                    <Stack
                      flexGrow={1}
                      gap="md"
                      area="top"
                      direction={{xs: 'column', sm: 'row'}}
                      align={{xs: 'stretch', sm: 'start'}}
                    >
                      <FeedbackFilters />
                      <SearchContainer>
                        <FeedbackSearch />
                      </SearchContainer>
                    </Stack>
                  )}
                  {hasSetupOneFeedback || hasSlug ? (
                    isMediumOrSmaller ? (
                      smallerScreenView
                    ) : (
                      largeScreenView
                    )
                  ) : (
                    <SetupContainer>
                      <FeedbackSetupPanel />
                    </SetupContainer>
                  )}
                </LayoutGrid>
              </Stack>
            </ErrorBoundary>
          </PageFiltersContainer>
        </FeedbackQueryKeys>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const LayoutGrid = styled('div')<{hideTop?: boolean}>`
  overflow: hidden;
  flex-grow: 1;

  display: grid;
  gap: ${space(2)};
  place-items: stretch;

  padding: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    padding: ${space(2)} ${space(4)};
  }

  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'top top'
    'list details';

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    grid-template-rows: ${p => (p.hideTop ? '0fr minmax(0, 100vh)' : 'max-content 76vh')};
    grid-template-areas: ${p => (p.hideTop ? "'.' 'content'" : "'top' 'content'")};
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(195px, 1fr) 1.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(390px, 1fr) 2fr;
  }
`;

const Container = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

const SetupContainer = styled('div')`
  overflow: hidden;
  grid-column: 1 / -1;
`;

/**
 * Prevent the search box from growing infinitely.
 * See https://github.com/getsentry/sentry/pull/80328
 */
const SearchContainer = styled('div')`
  flex-grow: 1;
  min-width: 0;
`;

const JumpToSelectedButton = styled(Button)`
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 4%;
`;
