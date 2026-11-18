import {useMutation} from '@tanstack/react-query';
import {parseAsArrayOf, parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';

import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useErrorsOnlyFilter} from 'sentry/views/explore/conversations/hooks/useErrorsOnlyFilter';
import {useInvalidateSavedQueries} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {TraceItemDataset} from 'sentry/views/explore/types';

export function SaveConversationQueryButton() {
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
  const {errorsOnly} = useErrorsOnlyFilter();

  const {mutateAsync: saveQuery} = useMutation({
    mutationFn: ({name, starred}: {name: string; starred?: boolean}) => {
      const {datetime, projects, environments} = selection;
      return fetchMutation<{id: string}>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/explore/saved/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        method: 'POST',
        data: {
          name,
          dataset: 'ai_conversations',
          projects,
          environment: environments,
          statsPeriod: datetime.period ?? undefined,
          start: datetime.start ?? undefined,
          end: datetime.end ?? undefined,
          starred: starred ?? true,
          agent: agent?.length ? agent : undefined,
          errorsOnly: errorsOnly || undefined,
          query: [
            {
              fields: [],
              mode: Mode.SAMPLES,
              query: searchQuery ?? '',
            },
          ],
        },
      });
    },
  });

  function handleClick() {
    openSaveQueryModal({
      organization,
      source: 'conversations',
      traceItemDataset: TraceItemDataset.SPANS,
      saveQuery: async variables => {
        const response = await saveQuery(variables);
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
