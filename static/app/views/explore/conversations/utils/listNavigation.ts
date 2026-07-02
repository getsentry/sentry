import type {Location} from 'history';

/**
 * Router location state attached when navigating from the conversations list
 * into a conversation detail page.
 *
 * The detail page repurposes the `start`/`end` page-filter params as the
 * conversation's own time window, so the list's filters (date range, search
 * query, agent filter, sort, cursor) cannot live in the detail URL. Instead we
 * carry the full list querystring through router location state so the detail
 * breadcrumb can return to the exact list the user came from — mirroring
 * browser "back" behavior.
 */
export interface ConversationsListLocationState {
  conversationsListQuery?: Location['query'];
}

export function getConversationsListLocationState(
  query: Location['query']
): ConversationsListLocationState {
  return {conversationsListQuery: query};
}

function isConversationsListLocationState(
  state: unknown
): state is ConversationsListLocationState {
  return typeof state === 'object' && state !== null && 'conversationsListQuery' in state;
}

export function getConversationsListQueryFromState(
  state: unknown
): Location['query'] | undefined {
  return isConversationsListLocationState(state)
    ? state.conversationsListQuery
    : undefined;
}
