import {FeatureBadge} from '@sentry/scraps/badge';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
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
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

export default function ErrorsContent() {
  const organization = useOrganization();
  // TODO: max pickable days logic for error occurences

  return (
    <SentryDocumentTitle title={t('Errors')} orgSlug={organization?.slug}>
      <Layout.Page>
        <ErrorsHeader />
        <PageFiltersContainer>
          <ExploreBodySearch>
            <ErrorsFilterSection />
          </ExploreBodySearch>
        </PageFiltersContainer>
        <ErrorsBody />
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

function ErrorsHeader() {
  const hasPageFrameFeature = useHasPageFrameFeature();
  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        <Layout.Title>
          {t('Errors')} <FeatureBadge type="alpha" />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        {hasPageFrameFeature ? (
          <TopBar.Slot name="feedback">
            <FeedbackButton>{null}</FeedbackButton>
          </TopBar.Slot>
        ) : (
          <FeedbackButton />
        )}
      </Layout.HeaderActions>
    </Layout.Header>
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
