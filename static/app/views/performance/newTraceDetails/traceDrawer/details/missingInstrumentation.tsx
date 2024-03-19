import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/formatters';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceTabs';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import type {MissingInstrumentationNode, TraceTree, TraceTreeNode} from '../../traceTree';

import {TraceDrawerComponents} from './styles';

export function MissingInstrumentationNodeDetails({
  node,
  onParentClick,
}: {
  node: MissingInstrumentationNode;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  const parentTransaction = node.parent_transaction;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.IconTitleWrapper>
        <TraceDrawerComponents.IconBorder>
          <IconSpan color="blue300" size="md" />
        </TraceDrawerComponents.IconBorder>
        <div style={{fontWeight: 'bold'}}>{t('Missing Instrumentation')}</div>
      </TraceDrawerComponents.IconTitleWrapper>
      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          {parentTransaction ? (
            <Row title="Parent Transaction">
              <td className="value">
                <a href="#" onClick={() => onParentClick(parentTransaction)}>
                  {getTraceTabTitle(parentTransaction)}
                </a>
              </td>
            </Row>
          ) : null}
          <Row title={t('Gap Duration')}>
            {getDuration(node.value.timestamp - node.value.start_timestamp, 2, true)}
          </Row>
          <Row title={t('Previous Span')}>
            {node.previous.value.op} - {node.previous.value.description}
          </Row>
          <Row title={t('Next Span')}>
            {node.next.value.op} - {node.next.value.description}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}
