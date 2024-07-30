import type {Organization} from 'sentry/types/organization';

import type {TraceTree} from '../traceModels/traceTree';
import {TraceType} from '../traceType';

import GenericWarnings from './genericWarnings';
import {PerformanceSetupWarning} from './performanceSetupWarning';

type Props = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

function TraceWarnings(props: Props) {
  if (props.tree.type !== 'trace' || props.tree.shape === TraceType.ONE_ROOT) {
    return null;
  }

  if (props.tree.shape === TraceType.ONLY_ERRORS) {
    return (
      <PerformanceSetupWarning
        organization={props.organization}
        traceSlug={props.traceSlug}
        tree={props.tree}
      />
    );
  }

  return (
    <GenericWarnings
      organization={props.organization}
      traceSlug={props.traceSlug}
      tree={props.tree}
    />
  );
}

export default TraceWarnings;
