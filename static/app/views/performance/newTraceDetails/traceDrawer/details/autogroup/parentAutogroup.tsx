import {useMemo} from 'react';
import {useTheme} from '@emotion/react';

import {IconGroup} from 'sentry/icons';
import {t} from 'sentry/locale';

import type {TraceTreeNodeDetailsProps} from '../../../traceDrawer/tabs/traceTreeNodeDetails';
import type {ParentAutogroupNode} from '../../../traceModels/parentAutogroupNode';
import {TraceTree} from '../../../traceModels/traceTree';
import {makeTraceNodeBarColor} from '../../../traceRow/traceBar';
import {getTraceTabTitle} from '../../../traceState/traceTabs';
import {IssueList} from '.././issues/issues';
import {type SectionCardKeyValueList, TraceDrawerComponents} from '.././styles';

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

  const parentTransaction = TraceTree.ParentTransaction(node);

  const items: SectionCardKeyValueList = [
    {
      key: 'grouping_logic',
      subject: t('Grouping Logic'),
      value: t(
        'Chain of immediate and only children spans with the same operation as their parent.'
      ),
    },
    {
      key: 'group_count',
      subject: t('Group Count'),
      value: node.groupCount,
    },
    {
      key: 'grouping_key',
      subject: t('Grouping Key'),
      value: `${t('Span Operation')} : ${node.value.op}`,
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
      </TraceDrawerComponents.LegacyHeaderContainer>

      <IssueList issues={issues} node={node} organization={organization} />

      <TraceDrawerComponents.SectionCard items={items} title={t('General')} />
    </TraceDrawerComponents.DetailContainer>
  );
}
