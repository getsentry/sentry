import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {Row} from 'sentry/views/performance/traceDetails/styles';

import {
  makeTraceNodeBarColor,
  type ParentAutogroupNode,
} from '../../traceModels/traceTree';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

export function ParentAutogroupNodeDetails({
  node,
  organization,
  onParentClick,
  onTabScrollToNode,
}: TraceTreeNodeDetailsProps<ParentAutogroupNode>) {
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
        <TraceDrawerComponents.NodeActions
          organization={organization}
          node={node}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>

      <IssueList issues={issues} node={node} organization={organization} />

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          {parentTransaction ? (
            <Row title="Parent Transaction">
              <td className="value">
                <a onClick={() => onParentClick(parentTransaction)}>
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
