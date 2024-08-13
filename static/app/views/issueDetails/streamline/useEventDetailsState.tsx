import {type Reducer, useCallback, useReducer} from 'react';

import {parseFilterValueDate} from 'sentry/components/searchQueryBuilder/tokens/filter/parsers/date/parser';
import type {
  FieldDefinitionGetter,
  FocusOverride,
} from 'sentry/components/searchQueryBuilder/types';
import {
  isDateToken,
  makeTokenKey,
  parseQueryBuilderValue,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {stringifyToken} from 'sentry/components/searchSyntax/utils';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import type {
  SectionConfig,
  SectionKey,
} from 'sentry/views/issueDetails/streamline/context';

interface EventDetailsState {
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
  const existingConfig = state.sectionData[sectionKey] ?? {key: sectionKey};
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

export function useEventDetailsState() {
  const initialState: EventDetailsState = {
    searchQuery: '',
    sectionData: {},
  };

  const reducer: Reducer<EventDetailsState, EventDetailsActions> = useCallback(
    (state, action): EventDetailsState => {
      switch (action.type) {
        case 'OPEN_SECTION':
          console.log(JSON.stringify(action));
          return updateSectionConfig(state, action.key, {isOpen: true});
        case 'UPDATE_SECTION_CONFIG':
          console.log(JSON.stringify(action));
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
