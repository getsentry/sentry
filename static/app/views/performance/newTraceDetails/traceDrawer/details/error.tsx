import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/core/button';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {EventError} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isTraceErrorNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/traceIcons';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {makeTraceNodeBarColor} from 'sentry/views/performance/newTraceDetails/traceRow/traceBar';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {useHasTraceNewUi} from 'sentry/views/performance/newTraceDetails/useHasTraceNewUi';

import {IssueList} from './issues/issues';
import {type SectionCardKeyValueList, TraceDrawerComponents} from './styles';

export function ErrorNodeDetails(
  props: TraceTreeNodeDetailsProps<
    TraceTreeNode<TraceTree.TraceError> | TraceTreeNode<TraceTree.EAPError>
  >
) {
  const hasTraceNewUi = useHasTraceNewUi();
  const {node, organization, onTabScrollToNode} = props;
  const issues = useMemo(() => {
    return [...node.errors];
  }, [node.errors]);

  if (!hasTraceNewUi) {
    return <LegacyErrorNodeDetails {...props} />;
  }

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('Error')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              subTitle={`ID: ${props.node.value.event_id}`}
              clipboardText={props.node.value.event_id}
            />
          </TraceDrawerComponents.LegacyTitleText>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer hasNewTraceUi={hasTraceNewUi}>
        {t(
          'This error is related to an ongoing issue. For details about how many users this affects and more, go to the issue below.'
        )}
        <IssueList issues={issues} node={node} organization={organization} />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

function LegacyErrorNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<
  TraceTreeNode<TraceTree.TraceError> | TraceTreeNode<TraceTree.EAPError>
>) {
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

  const items: SectionCardKeyValueList = [];

  if (isTraceErrorNode(node)) {
    items.push({
      key: 'title',
      subject: t('Title'),
      value: <TraceDrawerComponents.CopyableCardValueWithLink value={node.value.title} />,
    });
  }

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

  const description = isTraceErrorNode(node)
    ? (node.value.message ?? node.value.title)
    : node.value.description;
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
            <TraceDrawerComponents.TitleOp text={description ?? 'Error'} />
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
      <TraceDrawerComponents.BodyContainer>
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
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  ) : null;
}
const StackTraceWrapper = styled('div')`
  .traceback {
    margin-bottom: 0;
    border: 0;
  }
`;
