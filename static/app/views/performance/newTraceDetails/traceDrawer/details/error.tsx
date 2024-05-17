import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {EventError} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/icons';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';

import {
  makeTraceNodeBarColor,
  type TraceTree,
  type TraceTreeNode,
} from '../../traceModels/traceTree';

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

  const {isLoading, data} = useApiQuery<EventError>(
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
  const parentTransaction = node.parent_transaction;

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

  return isLoading ? (
    <LoadingIndicator />
  ) : data ? (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconBorder
            backgroundColor={makeTraceNodeBarColor(theme, node)}
          >
            <TraceIcons.Icon event={node.value} />
          </TraceDrawerComponents.IconBorder>
          <TraceDrawerComponents.TitleText>
            <div>{node.value.level ?? t('error')}</div>
            <TraceDrawerComponents.TitleOp>
              {' '}
              {node.value.message ?? node.value.title ?? 'Error'}
            </TraceDrawerComponents.TitleOp>
          </TraceDrawerComponents.TitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.Actions>
          <TraceDrawerComponents.NodeActions
            node={node}
            organization={organization}
            onTabScrollToNode={onTabScrollToNode}
          />
          <Button size="xs" to={generateIssueEventTarget(node.value, organization)}>
            {t('Go to Issue')}
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>

      <IssueList issues={issues} node={node} organization={organization} />

      <TraceDrawerComponents.SectionCard
        items={[
          {
            key: 'stack_trace',
            subject: null,
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
