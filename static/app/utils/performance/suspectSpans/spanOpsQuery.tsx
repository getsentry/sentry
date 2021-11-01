import {ReactNode} from 'react';
import omit from 'lodash/omit';

import GenericDiscoverQuery, {
  DiscoverQueryProps,
  GenericChildrenProps,
} from 'app/utils/discover/genericDiscoverQuery';
import withApi from 'app/utils/withApi';

import {SpanOps} from './types';

type SpanOpsProps = {};

type RequestProps = DiscoverQueryProps & SpanOpsProps;

type ChildrenProps = Omit<GenericChildrenProps<SpanOpsProps>, 'tableData'> & {
  spanOps: SpanOps | null;
};

type Props = RequestProps & {
  children: (props: ChildrenProps) => ReactNode;
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

export default withApi(SpanOpsQuery);
