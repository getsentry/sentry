import omit from 'lodash/omit';

import type {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'sentry/utils/discover/genericDiscoverQuery';
import GenericDiscoverQuery from 'sentry/utils/discover/genericDiscoverQuery';

import type {SpanOps} from './types';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type SpanOpsProps = {};

type RequestProps = DiscoverQueryProps & SpanOpsProps;

type ChildrenProps = Omit<GenericChildrenProps<SpanOpsProps>, 'tableData'> & {
  spanOps: SpanOps | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => React.ReactNode;
};

function SpanOpsQuery(props: Props) {
  return (
    <GenericDiscoverQuery<SpanOps, SpanOpsProps>
      route="events-span-ops"
      limit={20}
      {...omit(props, 'children')}
    >
      {({tableData, ...rest}) => {
        return props.children({spanOps: tableData, ...rest});
      }}
    </GenericDiscoverQuery>
  );
}

export default SpanOpsQuery;
