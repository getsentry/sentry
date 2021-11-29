import {ReactNode} from 'react';
import omit from 'lodash/omit';

import {defined} from 'sentry/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import withApi from 'sentry/utils/withApi';

import {SuspectSpans} from './types';

type SuspectSpansProps = {
  perSuspect?: number;
  spanOps?: string[];
};

type RequestProps = DiscoverQueryProps & SuspectSpansProps;

type ChildrenProps = Omit<GenericChildrenProps<SuspectSpansProps>, 'tableData'> & {
  suspectSpans: SuspectSpans | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => ReactNode;
};

function getSuspectSpanPayload(props: RequestProps) {
  const {perSuspect, spanOps} = props;
  const payload = {perSuspect, spanOp: spanOps};
  if (!defined(payload.perSuspect)) {
    delete payload.perSuspect;
  }
  if (!defined(payload.spanOp)) {
    delete payload.spanOp;
  }
  const additionalPayload = omit(props.eventView.getEventsAPIPayload(props.location), [
    'field',
  ]);
  return Object.assign(payload, additionalPayload);
}

function SuspectSpansQuery(props: Props) {
  return (
    <GenericDiscoverQuery<SuspectSpans, SuspectSpansProps>
      route="events-spans-performance"
      getRequestPayload={getSuspectSpanPayload}
      limit={4}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({suspectSpans: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(SuspectSpansQuery);
