import {parseAsArrayOf, parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function SaveConversationQueryButton() {
  const api = useApi();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const invalidateSavedQueries = useInvalidateSavedQueries();
  const [searchQuery] = useQueryState(
    'query',
    parseAsString.withOptions({history: 'replace'})
  );
  const [{agent}] = useQueryStates(
    {agent: parseAsArrayOf(parseAsString)},
    {history: 'replace'}
  );

  function handleClick() {
    openSaveQueryModal({
      organization,
      source: 'conversations',
      traceItemDataset: TraceItemDataset.SPANS,
      saveQuery: async (name, starred) => {
        const {datetime, projects, environments} = selection;
        const response = await api.requestPromise(
          `/organizations/${organization.slug}/explore/saved/`,
          {
            method: 'POST',
            data: {
              name,
              dataset: 'ai_conversations',
              projects,
              environment: environments,
              range: datetime.period ?? undefined,
              start: datetime.start ?? undefined,
              end: datetime.end ?? undefined,
              starred: starred ?? true,
              agent: agent?.length ? agent : undefined,
              query: [
                {
                  fields: [],
                  mode: Mode.SAMPLES,
                  query: searchQuery ?? '',
                },
              ],
            },
          }
        );
        invalidateSavedQueries();
        return response;
      },
    });
  }

  return (
    <Button variant="primary" onClick={handleClick} aria-label={t('Save as')}>
      {t('Save as')}
    </Button>
  );
}
