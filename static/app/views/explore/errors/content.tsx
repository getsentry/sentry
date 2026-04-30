import {Fragment} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  ExploreBodyContent,
  ExploreBodySearch,
} from 'sentry/views/explore/components/styles';
import {
  ErrorsContentSection,
  ErrorsControlSection,
} from 'sentry/views/explore/errors/body';
import {ErrorsFilterSection} from 'sentry/views/explore/errors/filterContent';
import {useControlSectionExpanded} from 'sentry/views/explore/hooks/useControlSectionExpanded';
import {TopBar} from 'sentry/views/navigation/topBar';

export default function ErrorsContent() {
  const organization = useOrganization();
  // TODO: max pickable days logic for error occurences

  return (
    <SentryDocumentTitle title={t('Errors')} orgSlug={organization?.slug}>
      <ErrorsHeader />
      <PageFiltersContainer>
        <ExploreBodySearch>
          <ErrorsFilterSection />
        </ExploreBodySearch>
      </PageFiltersContainer>
      <ErrorsBody />
    </SentryDocumentTitle>
  );
}

function ErrorsHeader() {
  return (
    <Fragment>
      <TopBar.Slot name="title">
        {t('Errors')} <FeatureBadge type="alpha" />
      </TopBar.Slot>
      <TopBar.Slot name="feedback">
        <FeedbackButton
          aria-label={t('Give Feedback')}
          tooltipProps={{title: t('Give Feedback')}}
        >
          {null}
        </FeedbackButton>
      </TopBar.Slot>
    </Fragment>
  );
}

const ERRORS_TOOLBAR_STORAGE_KEY = 'explore-errors-toolbar';

export function ErrorsBody() {
  const [controlSectionExpanded, setControlSectionExpanded] = useControlSectionExpanded(
    ERRORS_TOOLBAR_STORAGE_KEY
  );

  return (
    <ExploreBodyContent>
      <ErrorsControlSection controlSectionExpanded={controlSectionExpanded} />
      <ErrorsContentSection
        controlSectionExpanded={controlSectionExpanded}
        setControlSectionExpanded={setControlSectionExpanded}
      />
    </ExploreBodyContent>
  );
}
