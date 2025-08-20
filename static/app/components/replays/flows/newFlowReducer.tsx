import {uuid4} from '@sentry/core';

import type {PageFilters} from 'sentry/types/core';
import type {
  AssertionAction,
  AssertionFlow,
  StartingAssertionAction,
} from 'sentry/utils/replays/assertions/types';

type SetNameAction = {
  name: string;
  type: 'set_name';
};

type SetProjectIdAction = {
  project_id: string;
  type: 'set_project_id';
};

type SetEnvironmentAction = {
  environment: string;
  type: 'set_environment';
};

type SetStartingActionAction = {
  starting_action: StartingAssertionAction;
  type: 'set_starting_action';
};

type Action =
  | SetNameAction
  | SetProjectIdAction
  | SetEnvironmentAction
  | SetStartingActionAction;

export default function newFlowReducer(state: AssertionFlow, action: Action) {
  switch (action.type) {
    case 'set_name':
      return {...state, name: action.name};
    case 'set_project_id':
      return {...state, project_id: action.project_id};
    case 'set_environment':
      return {...state, environment: action.environment};
    case 'set_starting_action':
      return {
        ...state,
        name: state.name || nameFromAction(action.starting_action),
        starting_action: action.starting_action,
      };
    default:
      return state;
  }
}

export function defaultNewFlow(selection: PageFilters): AssertionFlow {
  const id = uuid4();
  return {
    alerts_enabled: false,
    assigned_to: undefined,
    created_at: new Date().toISOString(), // ISO 8601
    description: '',
    ending_actions: [],
    environment: selection.environments?.[0] ?? 'prod',
    id,
    name: '',
    original_id: id,
    prev_id: undefined,
    project_id: String(selection.projects?.[0] ?? ''),
    starting_action: {matcher: null, type: 'null'},
    status: 'success',
    timeout: 5 * 60 * 1000, // 5 minutes
  };
}

function nameFromAction(action: AssertionAction): string {
  switch (action.type) {
    case 'breadcrumb': {
      if (action.category === 'ui.click') {
        return `Click ${action.matcher.dom_element.selector}`;
      }
      return '';
    }
    case 'span':
      return '';
    case 'timeout':
      return `Timeout after ${action.matcher.timeout}ms`;
    case 'null':
    default:
      return '';
  }
}
