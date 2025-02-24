import {Fragment, useCallback, useRef} from 'react';

import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useFetchSequentialPages', story => {
  story('WARNING!', () => (
    <Fragment>
      <p>
        Using this hook might not be a good idea!
        <br />
        Pagination is a good strategy to limit the amount of data that a server needs to
        fetch at a given time, it also limits the amount of data that the browser needs to
        hold in memory. Loading all data with this hook could cause rate-limiting, memory
        exhaustion, slow rendering, and other problems.
      </p>
      <p>
        Before implementing a sequential-fetch you should first think about building new
        api endpoints that return just the data you need (in a paginated way), or look at
        the feature design itself and make adjustments.
      </p>
    </Fragment>
  ));

  story('useFetchSequentialPages', () => {
    const organization = useOrganization();
    const {pages, isFetching} = useFetchSequentialPages<{data: unknown}>({
      enabled: true,
      initialCursor: undefined,
      getQueryKey: useCallback(
        ({cursor, per_page}) => {
          // console.log('cursor', cursor);
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
          <code>useFetchSequentialPages</code> will fetch all pages of data for a given
          query. After all pages are fetched the full list of responses is returned as
          `pages`. The UI doesn't incrementally render as data is coming in.
        </p>
        <p>
          Note that <code>getQueryKey</code> needs to be a stable reference, so wrap it
          with <code>useCallback</code>.
        </p>
        <StructuredEventData data={{pages: pages.length, isFetching}} />
      </Fragment>
    );
  });

  story('Interrupt a sequential series', () => {
    const organization = useOrganization();
    const pagesFetched = useRef(0);

    const {pages, isFetching} = useFetchSequentialPages<{data: unknown}>({
      enabled: true,
      initialCursor: undefined,
      getQueryKey: useCallback(
        ({cursor, per_page}) => {
          pagesFetched.current++;
          if (pagesFetched.current > 2) {
            return undefined;
          }

          return [
            `/organizations/${organization.slug}/projects/`,
            {query: {cursor, per_page}},
          ];
        },
        [organization.slug]
      ),
      perPage: 1,
    });

    return (
      <Fragment>
        <p>
          You can stop a series of requests from continuing by returning a{' '}
          <kbd>undefined</kbd> from the <code>getQueryKey</code> callback.
        </p>
        <p>Here we limit the number of pages to 2</p>
        <StructuredEventData data={{pages: pages.length, isFetching}} />
      </Fragment>
    );
  });
});
