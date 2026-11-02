import type {
  InvestigationThought,
  InvestigationToolActivity,
} from 'sentry/views/investigations/types';

/** The agent's reasoning, placed between the calls in a running status block. */
export type SeerStatusThought = {id: string; kind: 'thought'; text: string};

/** What a running status block lists: a phase's calls and the reasoning between them. */
export type SeerStatusActivity = InvestigationToolActivity | SeerStatusThought;

export function isThought(activity: SeerStatusActivity): activity is SeerStatusThought {
  return 'text' in activity;
}

export function isCall(
  activity: SeerStatusActivity
): activity is InvestigationToolActivity {
  return !isThought(activity);
}

/**
 * A phase's calls with the agent's reasoning put back between them.
 *
 * Seer keeps the reasoning in its own list, each thought naming the call it came
 * before, so tool activity keeps the kinds older code understands. A thought goes
 * right before its call; one no call has followed yet goes last. A thought whose
 * call is no longer in the list is history and is left out.
 */
export function withThoughts(
  toolActivity: InvestigationToolActivity[] = [],
  thoughts: InvestigationThought[] = []
): SeerStatusActivity[] {
  const beforeCall = new Map<string, SeerStatusThought[]>();
  const trailing: SeerStatusThought[] = [];
  for (const thought of thoughts) {
    const entry: SeerStatusThought = {
      id: thought.id,
      kind: 'thought',
      text: thought.text,
    };
    if (thought.beforeActivityId) {
      beforeCall.set(thought.beforeActivityId, [
        ...(beforeCall.get(thought.beforeActivityId) ?? []),
        entry,
      ]);
    } else {
      trailing.push(entry);
    }
  }
  return [
    ...toolActivity.flatMap(call => [...(beforeCall.get(call.id) ?? []), call]),
    ...trailing,
  ];
}
