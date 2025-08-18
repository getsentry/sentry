export type AssertionBreadcrumbMatcher =
  | {
      category: 'ui.click';
    }
  | {
      category: 'navigation';
    };

export type AssertionSpanMatcher = {
  op: 'navigation.navigate';
};

export type AssertionAction =
  | {
      matcher: null;
      type: 'null';
    }
  | {
      matcher: AssertionBreadcrumbMatcher;
      type: 'breadcrumb';
    }
  | {
      matcher: AssertionSpanMatcher;
      type: 'span';
    };

export type TimeoutDurationMs = number;

export type AssertionFlow = {
  alerts_enabled: boolean;
  assigned_to: string | undefined;
  created_at: string; // ISO 8601
  description: string;
  ending_actions: AssertionAction[];
  environment: string;
  id: string;
  name: string;
  prev_id: string | undefined;
  project_id: string;
  starting_action: AssertionAction;
  status: 'success' | 'failure';
  timeout: TimeoutDurationMs;
};

export type AssertionsFlowExample = {
  ended_at: string; // ISO 8601
  ending_action: AssertionAction;
  flow_id: string;
  replay_id: string;
  started_at: string; // ISO 8601
  starting_action: AssertionAction;
  status: 'success' | 'failure' | 'timeout';
  timeout: TimeoutDurationMs;
};
