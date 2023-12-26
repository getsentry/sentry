import {defined} from 'sentry/utils';
import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';

import {SpanExample} from './types';

type SpanExamplesProps = {
  spanGroup: string;
  spanOp: string;
  maxExclusiveTime?: string;
  minExclusiveTime?: string;
};

type RequestProps = DiscoverQueryProps & SpanExamplesProps;

export type ChildrenProps = Omit<GenericChildrenProps<SpanExamplesProps>, 'tableData'> & {
  examples: SpanExample[] | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function getSuspectSpanPayload(props: RequestProps) {
  const {spanOp, spanGroup, minExclusiveTime, maxExclusiveTime} = props;
  const span =
    defined(spanOp) && defined(spanGroup) ? `${spanOp}:${spanGroup}` : undefined;
  const payload = defined(span)
    ? {span, min_exclusive_time: minExclusiveTime, max_exclusive_time: maxExclusiveTime}
    : {};

  const {field: _, ...additionalPayload} = props.eventView.getEventsAPIPayload(
    props.location
  );

  return {...payload, ...additionalPayload};
}

function SuspectSpansQuery(props: Props) {
  const {children: _, ...propsWithoutChildren} = props;
  return (
    <GenericDiscoverQuery<SpanExample[], SpanExamplesProps>
      route="events-spans"
      getRequestPayload={getSuspectSpanPayload}
      {...propsWithoutChildren}
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

export default SuspectSpansQuery;
