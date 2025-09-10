import {Fragment, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import {Button} from 'sentry/components/core/button';
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
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

export default function FeedbackListPage() {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();

  useRedirectToFeedbackFromEvent();

  const feedbackId = useCurrentFeedbackId();

  const prefersStackedNav = usePrefersStackedNav();
  const theme = useTheme();
  const isMediumOrSmaller = useMedia(`(max-width: ${theme.breakpoints.md})`);

  // State for responsive behavior on medium screens and smaller
  const [showItemPreview, setShowItemPreview] = useState(false);

  // Show item preview when feedback is selected on medium screens and smaller
  useEffect(() => {
    if (isMediumOrSmaller) {
      const hasSlug = Boolean(feedbackId);
      setShowItemPreview(hasSlug);
    } else {
      setShowItemPreview(false);
    }
  }, [isMediumOrSmaller, feedbackId]);

  // Scroll to top when showing item preview
  useEffect(() => {
    if (isMediumOrSmaller && showItemPreview && feedbackId) {
      // Simple scroll to top
      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        });
      }, 100);
    }
  }, [isMediumOrSmaller, showItemPreview, feedbackId]);

  // should also scroll back to the selected item when going back to the list

  const handleBackToList = () => {
    setShowItemPreview(false);
  };

  const largeScreenView = (
    <Fragment>
      <SummaryListContainer style={{gridArea: 'list'}}>
        <FeedbackSummaryCategories />
        <Container>
          <FeedbackList />
        </Container>
      </SummaryListContainer>

      <Container style={{gridArea: 'details'}}>
        {isMediumOrSmaller && showItemPreview && (
          <BackButtonContainer>
            <Button
              icon={<IconArrow direction="left" size="sm" />}
              onClick={handleBackToList}
              size="sm"
            >
              {t('Back to List')}
            </Button>
          </BackButtonContainer>
        )}
        <AnalyticsArea name="details">
          <FeedbackItemLoader />
        </AnalyticsArea>
      </Container>
    </Fragment>
  );

  const smallScreenView = (
    <Fragment>
      {!showItemPreview && (
        <SummaryListContainer style={{gridArea: 'content'}}>
          <FeedbackSummaryCategories />
          <Container>
            <FeedbackList />
          </Container>
        </SummaryListContainer>
      )}

      {showItemPreview && (
        <Container style={{gridArea: 'content'}}>
          <BackButtonContainer>
            <Button
              icon={<IconArrow direction="left" size="sm" />}
              onClick={handleBackToList}
              size="sm"
            >
              {t('Back to List')}
            </Button>
          </BackButtonContainer>
          <AnalyticsArea name="details">
            <FeedbackItemLoader />
          </AnalyticsArea>
        </Container>
      )}
    </Fragment>
  );

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <FullViewport>
        <FeedbackQueryKeys organization={organization}>
          <Layout.Header unified={prefersStackedNav}>
            <Layout.HeaderContent unified={prefersStackedNav}>
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
          </Layout.Header>
          <PageFiltersContainer>
            <ErrorBoundary>
              <Background>
                <LayoutGrid hideTop={isMediumOrSmaller && showItemPreview}>
                  {!(isMediumOrSmaller && showItemPreview) && (
                    <FiltersContainer style={{gridArea: 'top'}}>
                      <FeedbackFilters />
                      <SearchContainer>
                        <FeedbackSearch />
                      </SearchContainer>
                    </FiltersContainer>
                  )}
                  {hasSetupOneFeedback || Boolean(feedbackId) ? (
                    isMediumOrSmaller ? (
                      smallScreenView
                    ) : (
                      largeScreenView
                    )
                  ) : (
                    <SetupContainer>
                      <FeedbackSetupPanel />
                    </SetupContainer>
                  )}
                </LayoutGrid>
              </Background>
            </ErrorBoundary>
          </PageFiltersContainer>
        </FeedbackQueryKeys>
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const Background = styled('div')`
  background: ${p => p.theme.background};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${space(2)};
`;

const SummaryListContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const LayoutGrid = styled('div')<{hideTop?: boolean}>`
  overflow: hidden;
  flex-grow: 1;

  display: grid;
  gap: ${space(2)};
  place-items: stretch;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)};
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)};
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    padding: ${space(2)} ${space(4)};
  }

  grid-template-rows: max-content 1fr;
  grid-template-areas:
    'top top'
    'list details';

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr;
    grid-template-rows: ${p =>
      p.hideTop ? '0fr 1fr' : 'max-content minmax(100vh, 1fr)'};
    grid-template-areas: ${p => (p.hideTop ? "'.' 'content'" : "'top' 'content'")};
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(195px, 1fr) 1.5fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: 390px 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(390px, 1fr) 2fr;
  }
`;

const BackButtonContainer = styled('div')`
  padding: ${space(2)};
`;

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SetupContainer = styled('div')`
  overflow: hidden;
  grid-column: 1 / -1;
`;

const FiltersContainer = styled('div')`
  display: flex;
  flex-grow: 1;
  gap: ${space(1)};
  align-items: flex-start;
`;

/**
 * Prevent the search box from growing infinitely.
 * See https://github.com/getsentry/sentry/pull/80328
 */
const SearchContainer = styled('div')`
  flex-grow: 1;
  min-width: 0;
`;
