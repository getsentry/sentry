import type {Organization} from 'sentry/types/organization';

import type {TraceTree} from '../traceModels/traceTree';
import {TraceShape} from '../traceModels/traceTree';

import {TraceErrorsOnlyWarnings} from './traceErrorsOnlyWarnings';

type Props = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

export function TraceTypeWarnings(props: Props) {
  if (props.tree.type !== 'trace') {
    // Trace is either loading, empty or failed to load
    return null;
  }

  // Only show warnings for traces that only contain errors
  if (props.tree.shape === TraceShape.ONLY_ERRORS) {
    return (
      <TraceErrorsOnlyWarnings
        organization={props.organization}
        traceSlug={props.traceSlug}
        tree={props.tree}
      />
    );
  }

  return null;
}
