import type {DeadRageSelectorItem} from 'sentry/views/replays/types';

export type UIClickAction = {
  category: 'ui.click';
  matcher: {
    dom_element: Omit<DeadRageSelectorItem['dom_element'], 'projectId'>;
  };
  type: 'breadcrumb';
};

export type NavigationAction = {
  category: 'navigation';
  matcher: {
    url: string;
  };
  type: 'breadcrumb';
};

export type NavigationNavigateAction = {
  matcher: undefined;
  op: 'navigation.navigate';
  type: 'span';
};

export type NullAction = {
  matcher: null;
  type: 'null';
};

type TimeoutDurationMs = number;
export type TimeoutAction = {
  category: 'timeout';
  matcher: {
    timeout: number;
  };
  type: 'timeout';
};

export type StartingAssertionAction =
  | NullAction
  | UIClickAction
  | NavigationAction
  | NavigationNavigateAction;

export type EndingAssertionAction =
  | NullAction
  | UIClickAction
  | NavigationAction
  | NavigationNavigateAction
  | TimeoutAction;

export type AssertionAction = StartingAssertionAction | EndingAssertionAction;

export type AssertionFlow = {
  alerts_enabled: boolean;
  assigned_to: string | undefined;
  created_at: string; // ISO 8601
  description: string;
  ending_actions: EndingAssertionAction[];
  environment: string;
  id: string;
  name: string;
  original_id: string;
  prev_id: string | undefined;
  project_id: string;
  starting_action: StartingAssertionAction;
  status: 'success' | 'failure';
  timeout: TimeoutDurationMs;
};

export type AssertionsFlowExample = {
  ended_at: string; // ISO 8601
  ending_action: EndingAssertionAction;
  flow_id: string;
  replay_id: string;
  started_at: string; // ISO 8601
  starting_action: StartingAssertionAction;
  status: 'success' | 'failure' | 'timeout';
  timeout: TimeoutDurationMs;
};
