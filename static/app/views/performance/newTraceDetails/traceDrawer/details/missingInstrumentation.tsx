import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/formatters';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceTabs';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import {
  makeTraceNodeBarColor,
  type MissingInstrumentationNode,
  type TraceTree,
  type TraceTreeNode,
} from '../../traceTree';

import {TraceDrawerComponents} from './styles';

export function MissingInstrumentationNodeDetails({
  node,
  onParentClick,
  scrollToNode,
}: {
  node: MissingInstrumentationNode;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  const theme = useTheme();
  const parentTransaction = node.parent_transaction;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconTitleWrapper>
            <TraceDrawerComponents.IconBorder
              backgroundColor={makeTraceNodeBarColor(theme, node)}
            >
              <IconSpan size="md" />
            </TraceDrawerComponents.IconBorder>
            <div style={{fontWeight: 'bold'}}>{t('Missing Instrumentation')}</div>
          </TraceDrawerComponents.IconTitleWrapper>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <Button size="xs" onClick={_e => scrollToNode(node)}>
            {t('Show in view')}
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>
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
