import {useCallback, useEffect, useMemo, useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import type {Client} from 'sentry/api';
import type {Member} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';

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
   * to be loaded.
   */
  loadMore: (searchTerm?: string) => Promise<void>;
  /**
   * The loaded members list.
   *
   * XXX(epurkhiser): This is a misnomer, these are actually the *users* who are
   * members of the organization, Members is a different object type.
   */
  members: User[];
  /**
   * This is an action provided to consumers for them to update the current
   * users result set using a simple search query.
   *
   * Will always add new options into the loaded result set.
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
   * When provided, fetches specified members by id if necessary and only
   * provides those members.
   */
  ids?: string[];
  /**
   * Number of members to return when not using `props.slugs`
   */
  limit?: number;
};

type FetchMemberOptions = {
  cursor?: State['nextCursor'];
  emails?: string[];
  ids?: Options['ids'];
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
  {emails, ids, search, limit, lastSearch, cursor}: FetchMemberOptions = {}
) {
  const query: {
    cursor?: typeof cursor;
    per_page?: number;
    query?: string;
  } = {};

  if (ids !== undefined && ids.length > 0) {
    query.query = ids.map(id => `user.id:${id}`).join(' ');
  }

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

  let hasMore: null | boolean = false;
  let nextCursor: null | string = null;
  const [data, , resp] = await api.requestPromise(`/organizations/${orgId}/members/`, {
    includeAllArgs: true,
    query,
  });

  const pageLinks = resp?.getResponseHeader('Link');
  if (pageLinks) {
    const paginationObject = parseLinkHeader(pageLinks);
    hasMore = paginationObject?.next?.results ?? null;
    nextCursor = paginationObject?.next?.cursor ?? null;
  }

  return {results: data as Member[], hasMore, nextCursor};
}

function getMemberUsers(members: Member[]) {
  return members.map(m => m.user).filter((user): user is User => user !== null);
}

/**
 * Provides organization member users.
 *
 * This hook also provides a way to select specific emails to ensure they are
 * loaded, as well as search (type-ahead) for more members that may not be in the
 * current result set.
 *
 * NOTE: It is NOT guaranteed that all members for an organization will be
 * loaded, so you should use this hook with the intention of providing specific
 * emails, or loading more through search.
 */
export function useMembers({ids, emails, limit}: Options = {}) {
  const api = useApi();
  const organization = useOrganization();
  const orgId = organization.slug;
  const [members, setMembers] = useState<User[]>([]);

  // Keep track of what queries we failed to find results for, otherwilse we'll
  // just keep trying to look those up since they'll never end up in the store
  // and {ids,emails}ToLoad will never be empty
  const [idsFailedToLoad, setIdsFailedToLoad] = useState<Set<string>>(new Set());
  const [emailsFailedToLoad, setEmailsFailedToLoad] = useState<Set<string>>(new Set());

  const memberIds = useMemo(() => new Set(members.map(u => u.id)), [members]);

  const idsToLoad = useMemo(
    () => ids?.filter(id => !memberIds.has(id) && !idsFailedToLoad.has(id)) ?? [],
    [ids, idsFailedToLoad, memberIds]
  );

  const memberEmails = useMemo(() => new Set(members.map(u => u.email)), [members]);

  const emailsToLoad = useMemo(
    () =>
      emails?.filter(
        email => !memberEmails.has(email) && !emailsFailedToLoad.has(email)
      ) ?? [],
    [emails, emailsFailedToLoad, memberEmails]
  );

  const shouldLoadByQuery = emailsToLoad.length > 0 || idsToLoad.length > 0;

  // If we don't need to make a request either for emails and we have members,
  // set initiallyLoaded to true
  const initiallyLoaded = !shouldLoadByQuery && members.length > 0;

  const [state, setState] = useState<State>({
    initiallyLoaded,
    fetching: false,
    hasMore: null,
    lastSearch: null,
    nextCursor: null,
    fetchError: null,
  });

  const loadMembersByQuery = useCallback(async () => {
    if (orgId === undefined) {
      return;
    }

    setState(prev => ({...prev, fetching: true}));
    try {
      const {results, hasMore, nextCursor} = await fetchMembers(api, orgId, {
        ids: idsToLoad,
        emails: emailsToLoad,
        limit,
      });

      const memberUsers = getMemberUsers(results);

      // Unique by `id` to avoid duplicates due to renames and state store data
      setMembers(prevMembers =>
        uniqBy<User>([...memberUsers, ...prevMembers], ({id}) => id)
      );

      // Track member identifiers we couldn't load to exclude them from future requests
      const failedIds = idsToLoad.filter(
        id => !results.some(member => member.user?.id === id)
      );
      if (failedIds.length > 0) {
        setIdsFailedToLoad(prev => new Set([...prev, ...failedIds]));
      }

      const failedEmails = emailsToLoad.filter(
        email => !results.some(member => member.user?.email === email)
      );
      if (failedEmails.length > 0) {
        setEmailsFailedToLoad(prev => new Set([...prev, ...failedEmails]));
      }

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
        fetchError: err as RequestError,
      }));
    }
  }, [api, emailsToLoad, idsToLoad, limit, orgId]);

  const handleFetchAdditionalMembers = useCallback(
    async (search?: string) => {
      const lastSearch = state.lastSearch;
      const cursor = state.nextCursor;

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

        const memberUsers = getMemberUsers(results);

        setMembers(prevMembers =>
          uniqBy<User>([...prevMembers, ...memberUsers], ({email}) => email)
        );

        setState(prev => ({
          ...prev,
          hasMore,
          fetching: false,
          initiallyLoaded: true,
          lastSearch: search ?? null,
          nextCursor,
        }));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console

        setState(prev => ({...prev, fetching: false, fetchError: err as RequestError}));
      }
    },
    [api, limit, orgId, state.lastSearch, state.nextCursor]
  );

  const handleSearch = useCallback(
    (search: string) => {
      if (search !== '') {
        return handleFetchAdditionalMembers(search);
      }

      setState(prev => ({...prev, lastSearch: search}));
      return Promise.resolve();
    },
    [handleFetchAdditionalMembers]
  );

  // Load specified member identifiers.
  useEffect(() => {
    if (shouldLoadByQuery) {
      loadMembersByQuery();
    }
  }, [shouldLoadByQuery, loadMembersByQuery]);

  useEffect(() => {
    if (ids || emails || members.length > 0 || state.fetching || state.initiallyLoaded) {
      return;
    }

    handleFetchAdditionalMembers();
  }, [
    emails,
    handleFetchAdditionalMembers,
    ids,
    members.length,
    state.fetching,
    state.initiallyLoaded,
  ]);

  const filteredMembers = useMemo(
    () =>
      emails || ids
        ? members.filter(m => emails?.includes(m.email) || ids?.includes(m.id))
        : members,
    [emails, members, ids]
  );

  const result: Result = {
    members: filteredMembers,
    fetching: state.fetching,
    initiallyLoaded: state.initiallyLoaded || initiallyLoaded,
    fetchError: state.fetchError,
    hasMore: state.hasMore,
    onSearch: handleSearch,
    loadMore: handleFetchAdditionalMembers,
  };

  return result;
}
