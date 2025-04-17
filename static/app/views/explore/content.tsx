import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {LinkButton} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {TourContextProvider} from 'sentry/components/tours/components';
import {useAssistant} from 'sentry/components/tours/useAssistant';
import {IconMegaphone} from 'sentry/icons/iconMegaphone';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import ExploreBreadcrumb from 'sentry/views/explore/components/breadcrumb';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {getTitleFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/title';
import {SpansTabContent} from 'sentry/views/explore/spans/spansTab';
import {
  EXPLORE_SPANS_TOUR_GUIDE_KEY,
  type ExploreSpansTour,
  ExploreSpansTourContext,
  ORDERED_EXPLORE_SPANS_TOUR,
  useExploreSpansTourModal,
} from 'sentry/views/explore/spans/tour';
import {useExploreSpansTour} from 'sentry/views/explore/spans/tour';
import {StarSavedQueryButton} from 'sentry/views/explore/starSavedQueryButton';
import {limitMaxPickableDays} from 'sentry/views/explore/utils';
import {usePrefersStackedNav} from 'sentry/views/nav/prefersStackedNav';

export function ExploreContent() {
  return (
    <SpansTabTour>
      <ExploreContentImpl />
    </SpansTabTour>
  );
}

function ExploreContentImpl() {
  const organization = useOrganization();
  const {defaultPeriod, maxPickableDays, relativeOptions} =
    limitMaxPickableDays(organization);
  const prefersStackedNav = usePrefersStackedNav();

  const location = useLocation();

  const title = getTitleFromLocation(location);
  const id = getIdFromLocation(location);

  useExploreSpansTourModal();

  return (
    <SentryDocumentTitle title={t('Traces')} orgSlug={organization?.slug}>
      <PageFiltersContainer maxPickableDays={maxPickableDays}>
        <Layout.Page>
          <Layout.Header unified={prefersStackedNav}>
            <Layout.HeaderContent unified={prefersStackedNav}>
              {title && defined(id) ? <ExploreBreadcrumb /> : null}
              <Layout.Title>
                {title ? title : t('Traces')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://github.com/getsentry/sentry/discussions/81239"
                  title={t(
                    'Find problematic spans/traces or compute real-time metrics via aggregation.'
                  )}
                  linkLabel={t('Read the Discussion')}
                />
                <FeatureBadge
                  tooltipProps={{
                    title: t(
                      'This feature is available for early adopters and the UX may change'
                    ),
                  }}
                  type="beta"
                />
              </Layout.Title>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                {!prefersStackedNav && (
                  <LinkButton
                    to={`/organizations/${organization.slug}/explore/saved-queries/`}
                    size="sm"
                  >
                    {t('Saved Queries')}
                  </LinkButton>
                )}
                <StarSavedQueryButton />
                <ActionsButton organization={organization} />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>
          <SpansTabContent
            defaultPeriod={defaultPeriod}
            maxPickableDays={maxPickableDays}
            relativeOptions={relativeOptions}
          />
        </Layout.Page>
      </PageFiltersContainer>
    </SentryDocumentTitle>
  );
}

interface SpansTabTourProps {
  children: ReactNode;
}

function SpansTabTour({children}: SpansTabTourProps) {
  const {data: assistantData} = useAssistant();
  const isTourCompleted = useMemo(() => {
    const tourData = assistantData?.find(
      item => item.guide === EXPLORE_SPANS_TOUR_GUIDE_KEY
    );

    // Prevent tour from showing until assistant data is loaded
    return tourData?.seen ?? true;
  }, [assistantData]);

  return (
    <TourContextProvider<ExploreSpansTour>
      tourKey={EXPLORE_SPANS_TOUR_GUIDE_KEY}
      isCompleted={isTourCompleted}
      orderedStepIds={ORDERED_EXPLORE_SPANS_TOUR}
      TourContext={ExploreSpansTourContext}
    >
      {children}
    </TourContextProvider>
  );
}

interface ActionsButtonProps {
  organization: Organization;
}

function ActionsButton({organization}: ActionsButtonProps) {
  const {startTour, isRegistered} = useExploreSpansTour();
  const openForm = useFeedbackForm();

  const location = useLocation();
  const navigate = useNavigate();
  const switchToOldTraceExplorer = useCallback(() => {
    navigate({
      ...location,
      query: {
        ...location.query,
        view: 'trace',
      },
    });
  }, [location, navigate]);

  const items = [
    {
      key: 'take-tour',
      label: t('Take a tour'),
      hidden: !isRegistered,
      onAction: () => {
        trackAnalytics('explore.spans.tour.started', {organization, method: 'dropdown'});
        startTour();
      },
    },
    {
      key: 'give-feedback',
      label: t('Give feedback on the UI'),
      hidden: !openForm,
      onAction: () => {
        openForm?.({
          messagePlaceholder: t('Tell us what you think about the new UI'),
          tags: {
            ['feedback.source']: 'explore.spans',
            ['feedback.owner']: 'explore',
          },
        });
      },
    },
    {
      key: 'switch-to-old-ui',
      label: t('Switch to old trace explore'),
      hidden: !organization.features.includes('visibility-explore-admin'),
      onAction: switchToOldTraceExplorer,
    },
  ];

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <StyledDropdownButton
          {...triggerProps}
          size="sm"
          aria-label={t('See Explore Spans Actions')}
        >
          <IconMegaphone />
        </StyledDropdownButton>
      )}
      items={items}
      position="bottom-end"
    />
  );
}

const StyledDropdownButton = styled(DropdownButton)`
  color: ${p => p.theme.button.primary.background};
  :hover {
    color: ${p => p.theme.button.primary.background};
  }
`;
