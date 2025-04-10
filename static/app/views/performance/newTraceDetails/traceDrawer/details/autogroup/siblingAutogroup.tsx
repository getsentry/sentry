import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {IconGroup} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {IssueList} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/issues/issues';
import {
  type SectionCardKeyValueList,
  TraceDrawerComponents,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {SiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/siblingAutogroupNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {makeTraceNodeBarColor} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';

export function SiblingAutogroupNodeDetails({
  node,
  organization,
  onParentClick,
  onTabScrollToNode,
}: TraceTreeNodeDetailsProps<SiblingAutogroupNode>) {
  const theme = useTheme();
  const issues = useMemo(() => {
    return [...node.errors, ...node.occurences];
  }, [node.errors, node.occurences]);

  const parentTransaction = TraceTree.ParentTransaction(node);

  const items: SectionCardKeyValueList = [
    {
      key: 'grouping_logic',
      subject: t('Grouping Logic'),
      value: t('5 or more sibling spans with the same operation and description.'),
    },
    {
      key: 'group_count',
      subject: t('Group Count'),
      value: node.groupCount,
    },
    {
      key: 'grouping_key',
      subject: t('Grouping Key'),
      value: tct('Span operation: [operation] and description: [description]', {
        operation: node.value.op,
        description: node.value.description,
      }),
    },
  ];

  if (parentTransaction) {
    items.push({
      key: 'parent_transaction',
      subject: t('Parent Transaction'),
      value: (
        <a onClick={() => onParentClick(parentTransaction)}>
          {getTraceTabTitle(parentTransaction)}
        </a>
      ),
    });
  }

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.LegacyHeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconTitleWrapper>
            <TraceDrawerComponents.IconBorder
              backgroundColor={makeTraceNodeBarColor(theme, node)}
            >
              <IconGroup />
            </TraceDrawerComponents.IconBorder>
            <div style={{fontWeight: 'bold'}}>{t('Autogroup')}</div>
          </TraceDrawerComponents.IconTitleWrapper>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          organization={organization}
          node={node}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.LegacyHeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        <IssueList issues={issues} node={node} organization={organization} />

        <TraceDrawerComponents.SectionCard items={items} title={t('General')} />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
