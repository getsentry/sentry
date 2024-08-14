import {type Reducer, useCallback, useReducer} from 'react';

import type {
  SectionConfig,
  SectionKey,
} from 'sentry/views/issueDetails/streamline/context';

export interface EventDetailsState {
  searchQuery: string;
  sectionData: {
    [key in SectionKey]?: SectionConfig;
  };
}

type OpenSectionAction = {
  key: SectionKey;
  type: 'OPEN_SECTION';
};

type UpdateSectionConfigAction = {
  config: Partial<SectionConfig>;
  key: SectionKey;
  type: 'UPDATE_SECTION_CONFIG';
};

function updateSectionConfig(
  state: EventDetailsState,
  sectionKey: SectionKey,
  updatedConfig: Partial<SectionConfig>
): EventDetailsState {
  const nextState = {
    ...state,
    sectionData: {
      ...state.sectionData,
    },
  };
  const existingConfig = nextState.sectionData[sectionKey] ?? {key: sectionKey};
  nextState.sectionData[sectionKey] = {...existingConfig, ...updatedConfig};
  return nextState;
}

type UpdateSearchQueryAction = {
  searchQuery: string;
  type: 'UPDATE_SEARCH_QUERY';
};

export type EventDetailsActions =
  | OpenSectionAction
  | UpdateSectionConfigAction
  | UpdateSearchQueryAction;

/**
 * If trying to use the current state of the event page, you likely want to use `useEventDetails`
 * instead. This hook is just meant to create state for the provider.
 */
export function useEventDetailsReducer() {
  const initialState: EventDetailsState = {
    searchQuery: '',
    sectionData: {},
  };

  const reducer: Reducer<EventDetailsState, EventDetailsActions> = useCallback(
    (state, action): EventDetailsState => {
      switch (action.type) {
        case 'OPEN_SECTION':
          return updateSectionConfig(state, action.key, {isOpen: true});
        case 'UPDATE_SECTION_CONFIG':
          return updateSectionConfig(state, action.key, action.config);
        case 'UPDATE_SEARCH_QUERY':
          return {...state, searchQuery: action.searchQuery};
        default:
          return state;
      }
    },
    []
  );

  const [state, dispatch] = useReducer(reducer, initialState);

  return {
    state,
    dispatch,
  };
}
