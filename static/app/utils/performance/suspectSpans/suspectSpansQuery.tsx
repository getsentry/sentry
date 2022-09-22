import omit from 'lodash/omit';

import {defined} from 'sentry/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';

import {SuspectSpans} from './types';

type SuspectSpansProps = {
  maxExclusiveTime?: string;
  minExclusiveTime?: string;
  perSuspect?: number;
  spanGroups?: string[];
  spanOps?: string[];
};

type RequestProps = DiscoverQueryProps & SuspectSpansProps;

export type ChildrenProps = Omit<GenericChildrenProps<SuspectSpansProps>, 'tableData'> & {
  suspectSpans: SuspectSpans | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getSuspectSpanPayload(props: RequestProps) {
  const {perSuspect, spanOps, spanGroups, minExclusiveTime, maxExclusiveTime} = props;
  const payload = {
    perSuspect,
    spanOp: spanOps,
    spanGroup: spanGroups,
    min_exclusive_time: minExclusiveTime,
    max_exclusive_time: maxExclusiveTime,
  };
  if (!defined(payload.perSuspect)) {
    delete payload.perSuspect;
  }
  if (!defined(payload.spanOp)) {
    delete payload.spanOp;
  }
  if (!defined(payload.spanGroup)) {
    delete payload.spanGroup;
  }
  const additionalPayload = props.eventView.getEventsAPIPayload(props.location);
  return {
    ...payload,
    ...additionalPayload,
  };
}

function SuspectSpansQuery(props: Props) {
  return (
    <GenericDiscoverQuery<SuspectSpans, SuspectSpansProps>
      route="events-spans-performance"
      getRequestPayload={getSuspectSpanPayload}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({suspectSpans: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default SuspectSpansQuery;
