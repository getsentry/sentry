import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {EventError} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';

import type {TraceTreeNodeDetailsProps} from '../../traceDrawer/tabs/traceTreeNodeDetails';
import {TraceIcons} from '../../traceIcons';
import {TraceTree} from '../../traceModels/traceTree';
import type {TraceTreeNode} from '../../traceModels/traceTreeNode';
import {makeTraceNodeBarColor} from '../../traceRow/traceBar';
import {getTraceTabTitle} from '../../traceState/traceTabs';

import {IssueList} from './issues/issues';
import {type SectionCardKeyValueList, TraceDrawerComponents} from './styles';

export function ErrorNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.TraceError>>) {
  const issues = useMemo(() => {
    return [...node.errors];
  }, [node.errors]);

  const {isPending, data} = useApiQuery<EventError>(
    [
      `/organizations/${organization.slug}/events/${node.value.project_slug}:${node.value.event_id}/`,
    ],
    {
      staleTime: 2 * 60 * 1000,
    }
  );

  const stackTrace = useMemo(() => {
    if (data) {
      return getStacktrace(data);
    }

    return null;
  }, [data]);

  const theme = useTheme();
  const parentTransaction = TraceTree.ParentTransaction(node);

  const items: SectionCardKeyValueList = [
    {
      key: 'title',
      subject: t('Title'),
      value: <TraceDrawerComponents.CopyableCardValueWithLink value={node.value.title} />,
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

  return isPending ? (
    <LoadingIndicator />
  ) : data ? (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.LegacyHeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconBorder
            backgroundColor={makeTraceNodeBarColor(theme, node)}
          >
            <TraceIcons.Icon event={node.value} />
          </TraceDrawerComponents.IconBorder>
          <TraceDrawerComponents.LegacyTitleText>
            <div>{node.value.level ?? t('error')}</div>
            <TraceDrawerComponents.TitleOp
              text={node.value.message ?? node.value.title ?? 'Error'}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <TraceDrawerComponents.NodeActions
            node={node}
            organization={organization}
            onTabScrollToNode={onTabScrollToNode}
          />
          <LinkButton size="xs" to={generateIssueEventTarget(node.value, organization)}>
            {t('Go to Issue')}
          </LinkButton>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.LegacyHeaderContainer>

      <IssueList issues={issues} node={node} organization={organization} />

      <TraceDrawerComponents.SectionCard
        items={[
          {
            key: 'stack_trace',
            subject: t('Stack Trace'),
            subjectNode: null,
            value:
              stackTrace && data ? (
                <StackTraceWrapper>
                  <StackTracePreviewContent event={data} stacktrace={stackTrace} />
                </StackTraceWrapper>
              ) : (
                t('No stack trace has been reported with this error')
              ),
          },
        ]}
        title={t('Stack Trace')}
      />

      <TraceDrawerComponents.SectionCard items={items} title={t('General')} />

      <TraceDrawerComponents.EventTags
        projectSlug={node.value.project_slug}
        event={data}
      />
    </TraceDrawerComponents.DetailContainer>
  ) : null;
}

const StackTraceWrapper = styled('div')`
  .traceback {
    margin-bottom: 0;
    border: 0;
  }
`;
