import {parseAsStringLiteral, useQueryState} from 'nuqs';

import {LinkButton} from '@sentry/scraps/button';
import {EmptyState} from '@sentry/scraps/emptyState';

import {PageFiltersContainer} from 'sentry/components/pageFilters/container';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';

import {ConversationClassifierWizard} from './components/conversationClassifierWizard';
import {CLASSIFIER_DATASETS} from './types';
import {getClassifiersPath} from './utils';

const PREVIEW_SELECTION = {
  datetime: {period: '7d', start: null, end: null, utc: null},
};

const datasetParser =
  parseAsStringLiteral(CLASSIFIER_DATASETS).withDefault('conversation');

export default function NewClassifier() {
  const organization = useOrganization();
  const [dataset] = useQueryState('dataset', datasetParser);

  return (
    <SentryDocumentTitle title={t('Create a classifier')} orgSlug={organization.slug}>
      <TopBar.Slot
        name="breadcrumbs"
        title={{type: 'page-title', label: t('Create a classifier')}}
        items={[
          {
            type: 'link',
            label: t('Classifiers'),
            to: getClassifiersPath(organization.slug),
          },
        ]}
      />
      {dataset === 'conversation' ? (
        <PageFiltersContainer
          disablePersistence
          skipLoadLastUsed
          defaultSelection={PREVIEW_SELECTION}
        >
          <ConversationClassifierWizard />
        </PageFiltersContainer>
      ) : (
        <EmptyState
          padding="3xl"
          title={t('Coming soon')}
          description={t('Classifiers on spans are not available yet.')}
          action={
            <LinkButton to={getClassifiersPath(organization.slug)}>
              {t('Back to classifiers')}
            </LinkButton>
          }
        />
      )}
    </SentryDocumentTitle>
  );
}
