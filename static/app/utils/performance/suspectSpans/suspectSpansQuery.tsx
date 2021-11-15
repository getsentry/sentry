import {ReactNode} from 'react';
import omit from 'lodash/omit';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

import {SuspectSpans} from './types';

type SuspectSpansProps = {
  spanOps: string[];
};

type RequestProps = DiscoverQueryProps & SuspectSpansProps;

type ChildrenProps = Omit<GenericChildrenProps<SuspectSpansProps>, 'tableData'> & {
  suspectSpans: SuspectSpans | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => ReactNode;
};

function getSuspectSpanPayload(props: RequestProps) {
  const payload = {spanOp: props.spanOps};
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
