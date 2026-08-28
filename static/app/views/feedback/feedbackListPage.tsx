import type {ReactNode} from 'react';
import {Fragment, useEffect, useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Grid, Stack, useResponsivePropValue} from '@sentry/scraps/layout';

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
  hasFeedbackContent,
  hideTop,
  content,
}: {
  content: ReactNode;
  feedbackProjectSlug: string;
  hasFeedbackContent: boolean;
  hideTop: boolean;
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
          <Grid
            columns={{
              zero: '1fr',
              '3xl': 'minmax(195px, 1fr) 1.5fr',
              '4xl': 'minmax(390px, 1fr) 2fr',
            }}
            areas={{
              zero: hideTop ? '"list"' : '"top" "list"',
              '3xl': '"top top" "list details"',
            }}
            rows={{
              zero: hideTop ? 'minmax(0, 1fr)' : 'max-content minmax(0, 1fr)',
              '3xl': 'max-content minmax(0, 1fr)',
            }}
            flex={1}
            minHeight={0}
            gap="xl"
            overflow="hidden"
            padding="lg xl"
          >
            <Grid
              gap="md"
              area="top"
              display={{zero: hideTop ? 'none' : 'grid', '3xl': 'grid'}}
              areas={{
                zero: `
                    "filters"
                    "search"
                    "actions"
                  `,
                xl: `
                    "filters actions"
                    "search search"
                  `,
                '3xl': '"filters search actions"',
              }}
              columns={{
                zero: '100%',
                xl: '1fr auto',
                '3xl': 'minmax(300px, auto) 1fr min-content',
              }}
              width="100%"
            >
              <Container area="filters" justifySelf={{zero: 'stretch', sm: 'start'}}>
                <FeedbackFilters />
              </Container>
              <Container area="search" minWidth={0}>
                <FeedbackSearch />
              </Container>
              <Container
                area="actions"
                alignSelf="start"
                justifySelf={{zero: 'stretch', sm: 'end'}}
                width={{zero: '100%', sm: 'auto'}}
              >
                {buttonProps => (
                  <LinkButton {...buttonProps} {...createAlertAction} variant="primary">
                    {t('Create Alert')}
                  </LinkButton>
                )}
              </Container>
            </Grid>
            {hasFeedbackContent ? (
              content
            ) : (
              <Container overflow="hidden" column="1 / -1">
                <FeedbackSetupPanel />
              </Container>
            )}
          </Grid>
        </Stack>
      </ErrorBoundary>
    </PageFiltersContainer>
  );
}

export default function FeedbackListPage() {
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

  const isCompact = useResponsivePropValue({zero: true, '3xl': false});
  const [showItemPreview, setShowItemPreview] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  // Keep the selected feedback in sync with the route. CSS decides whether it replaces
  // the list or appears beside it based on the available container width.
  useLayoutEffect(() => {
    setShowItemPreview(Boolean(feedbackId));
    if (feedbackId && isCompact) {
      window.scrollTo(0, 0);
    }
  }, [feedbackId, isCompact]);

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

  const pageContent = (
    <Fragment>
      <Stack
        area="list"
        gap="md"
        display={{zero: showItemPreview ? 'none' : 'flex', '3xl': 'flex'}}
      >
        <FeedbackSummaryCategories />
        <FeedbackPanel>
          <FeedbackList onItemSelect={handleItemSelect} />
          {selectedItemIndex !== null && (
            <Container display={{zero: 'block', '3xl': 'none'}}>
              <JumpToSelectedButton size="xs" onClick={handleJumpToSelectedItem}>
                {t('Jump to selected item')}
              </JumpToSelectedButton>
            </Container>
          )}
        </FeedbackPanel>
      </Stack>

      <Container
        area={{zero: 'list', '3xl': 'details'}}
        display={{zero: showItemPreview ? 'flex' : 'none', '3xl': 'flex'}}
        minHeight={0}
      >
        <FeedbackPanel>
          <AnalyticsArea name="details">
            <FeedbackItemLoader onBackToList={handleBackToList} />
          </AnalyticsArea>
        </FeedbackPanel>
      </Container>
    </Fragment>
  );

  const hasFeedbackContent = hasSetupOneFeedback || hasSlug;
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
            hasFeedbackContent={hasFeedbackContent}
            hideTop={showItemPreview}
            content={pageContent}
          />
        </FeedbackApiOptions>
      </Stack>
    </SentryDocumentTitle>
  );
}

function FeedbackPanel({children}: {children: ReactNode}) {
  return (
    <Stack border="primary" radius="md" flex={1} minHeight={0} overflow="hidden">
      {children}
    </Stack>
  );
}

const JumpToSelectedButton = styled(Button)`
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 4%;
`;
