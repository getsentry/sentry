import {Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {SpanDescription} from './rows/description';
import {GeneralInfo} from './rows/generalInfo';
import {SpanHTTPInfo} from './rows/http';
import {SpanKeys} from './rows/keys';
import {Tags} from './rows/tags';

type SpanDetailProps = {
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  openPanel: string | undefined;
  organization: Organization;
};

function SpanNodeDetailTable(props: SpanDetailProps) {
  const location = useLocation();
  const {organization} = props;
  const span = props.node.value;

  return (
    <Fragment>
      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <SpanDescription
            node={props.node}
            organization={organization}
            location={location}
          />
          <GeneralInfo
            node={props.node}
            organization={organization}
            location={location}
            onParentClick={props.onParentClick}
          />
          <SpanHTTPInfo span={span} />
          <Tags span={span} />
          <SpanKeys node={props.node} />
        </tbody>
      </TraceDrawerComponents.Table>
    </Fragment>
  );
}

export const ButtonGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

export default SpanNodeDetailTable;
