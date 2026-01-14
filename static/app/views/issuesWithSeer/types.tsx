import type {AutofixData} from 'sentry/components/events/autofix/types';
import type {Group} from 'sentry/types/group';

export interface RepoPRState {
  pr_number?: number;
  pr_url?: string;
  status?: 'open' | 'merged' | 'closed';
}

export interface IssueWithSeer {
  automation: {
    hasCodeChanges?: boolean;
    hasPR?: boolean;
    hasRCA?: boolean;
    hasSolution?: boolean;
    prLinks?: string[];
    seerState?: AutofixData | null;
  };
  issue: Group;
}

export interface SeerStatusCellProps {
  status: 'yes' | 'no' | 'in_progress' | 'error';
}

export interface PRStatusCellProps {
  prLinks?: string[];
  prStates?: Record<string, RepoPRState>;
}
