import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceTabs';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import {
  makeTraceNodeBarColor,
  type ParentAutogroupNode,
  type TraceTree,
  type TraceTreeNode,
} from '../../traceTree';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

export function ParentAutogroupNodeDetails({
  node,
  organization,
  onParentClick,
  scrollToNode,
}: {
  node: ParentAutogroupNode;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
  const theme = useTheme();
  const issues = useMemo(() => {
    return [...node.errors, ...node.performance_issues];
  }, [node.errors, node.performance_issues]);

  const parentTransaction = node.parent_transaction;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconTitleWrapper>
            <TraceDrawerComponents.IconBorder
              backgroundColor={makeTraceNodeBarColor(theme, node)}
            >
              <IconGroup size="md" />
            </TraceDrawerComponents.IconBorder>
            <div style={{fontWeight: 'bold'}}>{t('Autogroup')}</div>
          </TraceDrawerComponents.IconTitleWrapper>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <Button size="xs" onClick={_e => scrollToNode(node)}>
            {t('Show in view')}
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>

      <IssueList issues={issues} node={node} organization={organization} />

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
          <Row title={t('Grouping Logic')}>
            {t(
              'Chain of immediate and only children spans with the same operation as their parent.'
            )}
          </Row>
          <Row title={t('Group Count')}>{node.groupCount}</Row>
          <Row title={t('Grouping Key')}>
            {t('Span Operation')} : {node.value.op}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}
