import omit from 'lodash/omit';

import {defined} from 'sentry/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import withApi from 'sentry/utils/withApi';

import {SpanExample} from './types';

type SpanExamplesProps = {
  spanGroup: string;
  spanOp: string;
};

type RequestProps = DiscoverQueryProps & SpanExamplesProps;

export type ChildrenProps = Omit<GenericChildrenProps<SpanExamplesProps>, 'tableData'> & {
  examples: SpanExample[] | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getSuspectSpanPayload(props: RequestProps) {
  const {spanOp, spanGroup} = props;
  const span =
    defined(spanOp) && defined(spanGroup) ? `${spanOp}:${spanGroup}` : undefined;
  const payload = {span};
  if (!defined(payload.span)) {
    delete payload.span;
  }
  const additionalPayload = omit(props.eventView.getEventsAPIPayload(props.location), [
    'field',
  ]);
  return Object.assign(payload, additionalPayload);
}

function SuspectSpansQuery(props: Props) {
  return (
    <GenericDiscoverQuery<SpanExample[], SpanExamplesProps>
      route="events-spans"
      getRequestPayload={getSuspectSpanPayload}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({
          examples: tableData ?? null,
          ...rest,
        });
      }}
    </GenericDiscoverQuery>
  );
}

export default withApi(SuspectSpansQuery);
