import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import {Client} from 'sentry/api';
import MemberListStore from 'sentry/stores/memberListStore';
import OrganizationStore from 'sentry/stores/organizationStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Member, User} from 'sentry/types';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';

type State = {
  /**
   * The error that occurred if fetching failed
   */
  fetchError: null | RequestError;
  /**
   * This is state for when fetching data from API
   */
  fetching: boolean;
  /**
   * Indicates that User results (from API) are paginated and there are more
   * Users that are not in the initial response.
   *
   * A null value indicates that we don't know if there are more values.
   */
  hasMore: null | boolean;
  /**
   * Reflects whether or not the initial fetch for the requested Users was
   * fulfilled
   */
  initiallyLoaded: boolean;
  /**
   * The last query we searched. Used to validate the cursor
   */
  lastSearch: null | string;
  /**
   * Pagination
   */
  nextCursor?: null | string;
};

type Result = {
  /**
   * This is an action provided to consumers for them to request more members
   * to be loaded. Additional members will be fetched and loaded into the store.
   */
  loadMore: (searchTerm?: string) => Promise<void>;
  /**
   * The loaded members list.
   *
   * XXX(epurkhiser): This is a misnomer, these are actually the *users* who are
   * members of the organiation, Members is a different object type.
   */
  members: User[];
  /**
   * This is an action provided to consumers for them to update the current
   * users result set using a simple search query.
   *
   * Will always add new options into the store.
   */
  onSearch: (searchTerm: string) => Promise<void>;
} & Pick<State, 'fetching' | 'hasMore' | 'fetchError' | 'initiallyLoaded'>;

type Options = {
  /**
   * When provided, fetches specified members by email if necessary and only
   * provides those members.
   */
  emails?: string[];
  /**
   * Number of members to return when not using `props.slugs`
   */
  limit?: number;
};

type FetchMemberOptions = {
  cursor?: State['nextCursor'];
  emails?: string[];
  lastSearch?: State['lastSearch'];
  limit?: Options['limit'];
  search?: State['lastSearch'];
};

/**
 * Helper function to actually load members
 */
async function fetchMembers(
  api: Client,
  orgId: string,
  {emails, search, limit, lastSearch, cursor}: FetchMemberOptions = {}
) {
  const query: {
    cursor?: typeof cursor;
    per_page?: number;
    query?: string;
  } = {};

  if (emails !== undefined && emails.length > 0) {
    query.query = emails.map(email => `email:${email}`).join(' ');
  }

  if (search) {
    query.query = `${query.query ?? ''} ${search}`.trim();
  }

  const isSameSearch = lastSearch === search || (!lastSearch && !search);

  if (isSameSearch && cursor) {
    query.cursor = cursor;
  }

  if (limit !== undefined) {
    query.per_page = limit;
  }

  // XXX(epurkhiser): Very confusingly right now we actually store users in the
  // members store, so here we're fetching member objects, but later we just
  // extract out the user object from this.

  let hasMore: null | boolean = false;
  let nextCursor: null | string = null;
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/members/`, {
    includeAllArgs: true,
    query,
  });

  const pageLinks = resp?.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore = paginationObject?.next?.results;
    nextCursor = paginationObject?.next?.cursor;
  }

  return {results: data as Member[], hasMore, nextCursor};
}

// TODO: Paging for items which have already exist in the store is not
// correctly implemented.

/**
 * Provides members from the MemberListStore
 *
 * This hook also provides a way to select specific emails to ensure they are
 * loaded, as well as search (type-ahead) for more members that may not be in the
 * MemberListStore.
 *
 * NOTE: It is NOT guaranteed that all members for an organization will be
 * loaded, so you should use this hook with the intention of providing specific
 * emails, or loading more through search.
 */
export function useMembers({emails, limit}: Options = {}) {
  const api = useApi();
  const {organization} = useLegacyStore(OrganizationStore);
  const store = useLegacyStore(MemberListStore);

  const orgId = organization?.slug;

  const storeEmails = useMemo(
    () => new Set(store.members.map(u => u.email)),
    [store.members]
  );

  const emailsToLoad = useMemo(
    () => emails?.filter(email => !storeEmails.has(email)) ?? [],
    [emails, storeEmails]
  );

  const shouldLoadEmails = emailsToLoad.length > 0;

  // If we don't need to make a request either for emails and we have members,
  // set initiallyLoaded to true
  const initiallyLoaded = !shouldLoadEmails && store.members.length > 0;

  const [state, setState] = useState<State>({
    initiallyLoaded,
    fetching: false,
    hasMore: store.hasMore,
    lastSearch: null,
    nextCursor: store.cursor,
    fetchError: null,
  });

  const emailsRef = useRef<Set<string> | null>(null);

  // Only initialize emailsRef.current once and modify it when we receive new
  // emails determined through set equality
  if (emails !== undefined) {
    const emailList = emails ?? [];
    if (emailsRef.current === null) {
      emailsRef.current = new Set(emailList);
    }

    if (
      emailList.length !== emailsRef.current.size ||
      emailList.some(email => !emailsRef.current?.has(email))
    ) {
      emailsRef.current = new Set(emailList);
    }
  }

  const loadMembersByEmail = useCallback(
    async function () {
      if (orgId === undefined) {
        return;
      }

      setState(prev => ({...prev, fetching: true}));
      try {
        const {results, hasMore, nextCursor} = await fetchMembers(api, orgId, {
          emails: emailsToLoad,
          limit,
        });

        const memberUsers = results
          .map(m => m.user)
          .filter((user): user is User => user !== null);

        // Unique by `id` to avoid duplicates due to renames and state store data
        const fetchedMembers = uniqBy<User>(
          [...memberUsers, ...store.members],
          ({id}) => id
        );
        MemberListStore.loadInitialData(fetchedMembers);

        setState(prev => ({
          ...prev,
          hasMore,
          fetching: false,
          initiallyLoaded: true,
          nextCursor,
        }));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        setState(prev => ({
          ...prev,
          fetching: false,
          initiallyLoaded: true,
          fetchError: err,
        }));
      }
    },
    [api, emailsToLoad, limit, orgId, store.members]
  );

  const handleFetchAdditionalMembers = useCallback(
    async function (search?: string) {
      const lastSearch = state.lastSearch;
      // Use the store cursor if there is no search keyword provided
      const cursor = search ? state.nextCursor : store.cursor;

      if (orgId === undefined) {
        // eslint-disable-next-line no-console
        console.error('Cannot fetch members without an organization in context');
        return;
      }

      setState(prev => ({...prev, fetching: true}));

      try {
        api.clear();
        const {results, hasMore, nextCursor} = await fetchMembers(api, orgId, {
          search,
          limit,
          lastSearch,
          cursor,
        });

        const memberUsers = results
          .map(m => m.user)
          .filter((user): user is User => user !== null);

        const fetchedMembers = uniqBy<User>(
          [...store.members, ...memberUsers],
          ({email}) => email
        );

        if (search) {
          // Only update the store if we have more items
          if (fetchedMembers.length > store.members.length) {
            MemberListStore.loadInitialData(fetchedMembers);
          }
        } else {
          // If we fetched a page of members without a search query, add cursor
          // data to the store
          MemberListStore.loadInitialData(fetchedMembers, hasMore, nextCursor);
        }

        setState(prev => ({
          ...prev,
          hasMore: hasMore && store.hasMore,
          fetching: false,
          lastSearch: search ?? null,
          nextCursor,
        }));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        setState(prev => ({...prev, fetching: false, fetchError: err}));
      }
    },
    [
      api,
      limit,
      orgId,
      state.lastSearch,
      state.nextCursor,
      store.cursor,
      store.hasMore,
      store.members,
    ]
  );

  const handleSearch = useCallback(
    function (search: string) {
      if (search !== '') {
        return handleFetchAdditionalMembers(search);
      }

      // Reset pagination state to match store if doing an empty search
      if (state.hasMore !== store.hasMore || state.nextCursor !== store.cursor) {
        setState(prev => ({
          ...prev,
          lastSearch: search,
          hasMore: store.hasMore,
          nextCursor: store.cursor,
        }));
      }

      return Promise.resolve();
    },
    [
      handleFetchAdditionalMembers,
      state.hasMore,
      state.nextCursor,
      store.cursor,
      store.hasMore,
    ]
  );

  // Load specified team slugs
  useEffect(() => {
    if (shouldLoadEmails) {
      loadMembersByEmail();
    }
  }, [shouldLoadEmails, loadMembersByEmail]);

  const filteredMembers = useMemo(
    () => (emails ? store.members.filter(m => emails.includes(m.email)) : store.members),
    [store.members, emails]
  );

  const result: Result = {
    members: filteredMembers,
    fetching: state.fetching || store.loading,
    initiallyLoaded: state.initiallyLoaded,
    fetchError: state.fetchError,
    hasMore: state.hasMore ?? store.hasMore,
    onSearch: handleSearch,
    loadMore: handleFetchAdditionalMembers,
  };

  return result;
}
