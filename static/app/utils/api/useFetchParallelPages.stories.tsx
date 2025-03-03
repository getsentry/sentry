import {Fragment, useCallback} from 'react';

import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useFetchParallelPages from 'sentry/utils/api/useFetchParallelPages';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useFetchParallelPages', story => {
  story('WARNING!', () => (
    <Fragment>
      <p>
        Using this hook might not be a good idea!
        <br />
        Pagination is a good strategy to limit the amount of data that a server needs to
        fetch at a given time; it also limits the amount of data that the browser needs to
        hold in memory. Loading all data with this hook could cause rate-limiting, memory
        exhaustion, slow rendering, and other problems.
      </p>
      <p>
        Before implementing a parallel-fetch you should first think about building new api
        endpoints that return just the data you need (in a paginated way), or look at the
        feature design itself and make adjustments.
      </p>
    </Fragment>
  ));

  story('useFetchParallelPages', () => {
    const organization = useOrganization();

    const hits = 200; // the maximum number of items we expect to fetch

    const {pages, isFetching} = useFetchParallelPages<{data: unknown}>({
      enabled: true,
      hits,
      getQueryKey: useCallback(
        ({cursor, per_page}) => {
          return [
            `/organizations/${organization.slug}/projects/`,
            {query: {cursor, per_page}},
          ];
        },
        [organization.slug]
      ),
      perPage: 20,
    });

    return (
      <Fragment>
        <p>
          <code>useFetchParallelPages</code> will fetch all pages of data for a given
          query. The return value of the hook will update as requests complete, meaning
          that the UI can update incrementally.
        </p>
        <p>
          Note that you need to set <code>hits</code> and <code>perPage</code> so the
          helper can know how many requests to make. If you don't already know how many
          results to expect then it can be helpful to manually request the first full page
          of results, check the <code>X-Hits</code> response header, then use the hook to
          fetch the complete list of results. Use the same <code>perPage</code> value in
          both callsites to leverage the query cache.
        </p>
        <p>
          Note that <code>getQueryKey</code> needs to be a stable reference, so wrap it
          with <code>useCallback</code>.
        </p>
        <StructuredEventData data={{pages: pages.length, isFetching}} />
      </Fragment>
    );
  });
});
