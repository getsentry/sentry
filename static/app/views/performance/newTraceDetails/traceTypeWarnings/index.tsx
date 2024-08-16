import type {Organization} from 'sentry/types/organization';

import type {TraceTree} from '../traceModels/traceTree';
import {TraceType} from '../traceType';

import {ErrorsOnlyWarnings} from './errorsOnlyWarnings';

type Props = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

function TraceTypeWarnings(props: Props) {
  if (
    props.tree.type !== 'trace' ||
    props.tree.shape === TraceType.ONE_ROOT ||
    // Note: Just handling the errors-only-trace banners for now.
    props.tree.shape !== TraceType.ONLY_ERRORS
  ) {
    return null;
  }

  return (
    <ErrorsOnlyWarnings
      organization={props.organization}
      traceSlug={props.traceSlug}
      tree={props.tree}
    />
  );
}

export default TraceTypeWarnings;
