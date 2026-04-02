import {useCallback} from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
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
  return (
    <Layout.Header unified>
      <Layout.HeaderContent unified>
        <Layout.Title>
          {t('Errors')} <FeatureBadge type="alpha" />
        </Layout.Title>
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <FeedbackButton />
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export function ErrorsBody() {
  const [controlSectionExpanded, setControlSectionExpanded] =
    useErrorsControlSectionExpanded();

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

function useErrorsControlSectionExpanded() {
  const [controlSectionExpanded, _setControlSectionExpanded] = useLocalStorageState(
    'explore-errors-toolbar',
    'expanded'
  );

  const setControlSectionExpanded = useCallback(
    (expanded: boolean) => {
      _setControlSectionExpanded(expanded ? 'expanded' : '');
    },
    [_setControlSectionExpanded]
  );

  return [controlSectionExpanded === 'expanded', setControlSectionExpanded] as const;
}
