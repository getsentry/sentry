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
    // Note: We have plans to show the generic banners for all incomplete (i.e except ONE_ROOT) trace shapes, but
    // for now we are only showing it for traces with errors.
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
