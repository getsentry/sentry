import type {ReactNode} from 'react';
import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {useDrawer} from '@sentry/scraps/drawer';
import {Flex, Stack, useResponsivePropValue} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FeedbackFilters} from 'sentry/components/feedback/feedbackFilters';
import {FeedbackItemLoader} from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import {FeedbackSearch} from 'sentry/components/feedback/feedbackSearch';
import {FeedbackSetupPanel} from 'sentry/components/feedback/feedbackSetupPanel';
import {FeedbackList} from 'sentry/components/feedback/list/feedbackList';
import {FeedbackSummaryCategories} from 'sentry/components/feedback/summaryCategories/feedbackSummaryCategories';
import {FeedbackApiOptions} from 'sentry/components/feedback/useFeedbackApiOptions';
import {useHaveSelectedProjectsSetupFeedback} from 'sentry/components/feedback/useFeedbackOnboarding';
import {useFeedbackSlug} from 'sentry/components/feedback/useFeedbackSlug';
import {useRedirectToFeedbackFromEvent} from 'sentry/components/feedback/useRedirectToFeedbackFromEvent';
import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconSiren} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

const userFeedbackFeedbackOptions = {
  messagePlaceholder: t('How can we improve the User Feedback experience?'),
  tags: {
    'feedback.source': 'feedback-list',
  },
};

function PageContent({
  feedbackProjectSlug,
  hideTop,
  hasFeedbackContent,
  isCompact,
  content,
}: {
  content: ReactNode;
  feedbackProjectSlug: string;
  hasFeedbackContent: boolean;
  hideTop: boolean;
  isCompact: boolean;
}) {
  const organization = useOrganization();
  const createAlertAction = {
    icon: <IconSiren />,
    to: {
      pathname: makeAlertsPathname({
        path: '/new/issue/',
        organization,
      }),
      query: {
        alert_option: 'issues',
        referrer: 'feedback-list-page',
        detectorType: 'metric_issue',
        ...(feedbackProjectSlug ? {project: feedbackProjectSlug} : {}),
      },
    },
  };

  return (
    <PageFiltersContainer>
      <ErrorBoundary>
        <Stack flex={1} align="stretch" gap="xl" background="primary" overflow="hidden">
          <LayoutGrid hideTop={hideTop} isCompact={isCompact}>
            {!hideTop && (
              <Stack
                flexGrow={1}
                gap="md"
                area="top"
                direction={{zero: 'column', xl: 'row'}}
                align={{zero: 'stretch', xl: 'start'}}
              >
                <FeedbackFilters />
                <Flex
                  flexGrow={1}
                  gap="md"
                  direction={{zero: 'column', '3xl': 'row'}}
                  align={{zero: 'stretch', '3xl': 'center'}}
                >
                  <SearchContainer>
                    <FeedbackSearch />
                  </SearchContainer>
                  <LinkButton {...createAlertAction} variant="primary">
                    {t('Create Alert')}
                  </LinkButton>
                </Flex>
              </Stack>
            )}
            {hasFeedbackContent ? (
              content
            ) : (
              <SetupContainer>
                <FeedbackSetupPanel />
              </SetupContainer>
            )}
          </LayoutGrid>
        </Stack>
      </ErrorBoundary>
    </PageFiltersContainer>
  );
}

export default function FeedbackListPage() {
  return (
    <Stack flex={1} minHeight={0} containerType="inline-size" overflow="hidden">
      <FeedbackListPageContent />
    </Stack>
  );
}

function FeedbackListPageContent() {
  const organization = useOrganization();
  const {hasSetupOneFeedback} = useHaveSelectedProjectsSetupFeedback();
  const pageFilters = usePageFilters();

  const [feedbackSlug] = useFeedbackSlug();
  const feedbackId = feedbackSlug?.feedbackId ?? '';
  const feedbackProjectSlug = feedbackSlug?.projectSlug ?? '';
  const hasSlug = Boolean(feedbackId);

  const {query: locationQuery} = useLocation();
  const searchQuery = locationQuery.query ?? '';

  useRedirectToFeedbackFromEvent();

  const {isAnyDrawerOpen} = useDrawer();
  const isMediumOrSmaller = useResponsivePropValue({zero: true, '3xl': false});
  const isCompact = isMediumOrSmaller || isAnyDrawerOpen;
  const [showItemPreview, setShowItemPreview] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // Show the selected feedback item by itself whenever the page uses its compact layout.
  useEffect(() => {
    if (isCompact) {
      setShowItemPreview(Boolean(feedbackId));
      if (feedbackId) {
        window.scrollTo(0, 0);
      }
    } else {
      setShowItemPreview(false);
    }
  }, [isCompact, feedbackId]);

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
      <Stack area="list" gap="md">
        <FeedbackSummaryCategories />
        <Container>
          <FeedbackList onItemSelect={() => {}} />
        </Container>
      </Stack>

      <Container area="details">
        <AnalyticsArea name="details">
          <FeedbackItemLoader />
        </AnalyticsArea>
      </Container>
    </Fragment>
  );

  const smallerScreenView = (
    <Fragment>
      {showItemPreview ? (
        <Container area="list">
          <AnalyticsArea name="details">
            <FeedbackItemLoader onBackToList={handleBackToList} />
          </AnalyticsArea>
        </Container>
      ) : (
        <Stack area="list" gap="md">
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

  // Hide the search and filters when the compact layout is showing a feedback item.
  const hideTop = isCompact && showItemPreview;
  const hasFeedbackContent = hasSetupOneFeedback || hasSlug;
  const pageContent = isCompact ? smallerScreenView : largeScreenView;
  const titleContent = (
    <Fragment>
      {t('User Feedback')}
      <PageHeadingQuestionTooltip
        title={t(
          'The User Feedback Widget allows users to submit feedback quickly and easily any time they encounter something that isn’t working as expected.'
        )}
        docsUrl="https://docs.sentry.io/product/user-feedback/"
      />
    </Fragment>
  );

  return (
    <SentryDocumentTitle title={t('User Feedback')} orgSlug={organization.slug}>
      <Stack flex={1} minHeight={0} contain="size" overflow="hidden">
        <FeedbackApiOptions organization={organization}>
          <TopBar.Slot name="title">{titleContent}</TopBar.Slot>
          <TopBar.Slot name="feedback">
            <FeedbackButton
              size="sm"
              feedbackOptions={userFeedbackFeedbackOptions}
              aria-label={t('Give Feedback')}
              tooltipProps={{title: t('Give Feedback')}}
            >
              {null}
            </FeedbackButton>
          </TopBar.Slot>
          <PageContent
            feedbackProjectSlug={feedbackProjectSlug}
            hideTop={hideTop}
            hasFeedbackContent={hasFeedbackContent}
            isCompact={isCompact}
            content={pageContent}
          />
        </FeedbackApiOptions>
      </Stack>
    </SentryDocumentTitle>
  );
}

const LayoutGrid = styled('div')<{hideTop?: boolean; isCompact?: boolean}>`
  overflow: hidden;
  flex: 1;
  min-height: 0;

  display: grid;
  gap: ${p => p.theme.space.xl};
  place-items: stretch;

  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};

  grid-template-rows: max-content minmax(0, 1fr);
  grid-template-areas:
    'top top'
    'list details';

  @container (max-width: ${p => p.theme.container['3xl']}) {
    grid-template-columns: 1fr;
    grid-template-rows: ${p => (p.hideTop ? '0fr minmax(0, 100vh)' : 'max-content 76vh')};
    grid-template-areas: ${p => (p.hideTop ? "'.' 'list'" : "'top' 'list'")};
  }

  @container (min-width: ${p => p.theme.container['3xl']}) {
    grid-template-columns: minmax(195px, 1fr) 1.5fr;
  }

  @container (min-width: ${p => p.theme.container['4xl']}) {
    grid-template-columns: minmax(390px, 1fr) 2fr;
  }

  ${p =>
    p.isCompact &&
    css`
      grid-template-columns: 1fr;
      grid-template-rows: ${p.hideTop ? '0fr minmax(0, 100vh)' : 'max-content 76vh'};
      grid-template-areas: ${p.hideTop ? "'.' 'list'" : "'top' 'list'"};
    `}
`;

const Container = styled('div')<{area?: string}>`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  ${p =>
    p.area &&
    css`
      grid-area: ${p.area};
    `}
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
