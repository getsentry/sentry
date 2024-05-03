import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import type {EventError} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useLocation} from 'sentry/utils/useLocation';
import {TraceIcons} from 'sentry/views/performance/newTraceDetails/icons';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {Row, Tags} from 'sentry/views/performance/traceDetails/styles';

import {
  makeTraceNodeBarColor,
  type TraceTree,
  type TraceTreeNode,
} from '../../traceModels/traceTree';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

export function ErrorNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  onParentClick,
}: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.TraceError>>) {
  const location = useLocation();
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

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          {stackTrace ? (
            <tr>
              <StackTraceTitle>{t('Stack Trace')}</StackTraceTitle>
              <StackTraceWrapper>
                <StackTracePreviewContent event={data} stacktrace={stackTrace} />
              </StackTraceWrapper>
            </tr>
          ) : (
            <Row title={t('Stack Trace')}>
              {t('No stack trace has been reported with this error')}
            </Row>
          )}
          <Tags
            enableHiding
            location={location}
            organization={organization}
            event={node.value}
            tags={data.tags}
          />
          <Row
            title={t('Title')}
            extra={<CopyToClipboardButton size="xs" borderless text={node.value.title} />}
          >
            {node.value.title}
          </Row>
          {parentTransaction ? (
            <Row title="Parent Transaction">
              <td className="value">
                <a onClick={() => onParentClick(parentTransaction)}>
                  {getTraceTabTitle(parentTransaction)}
                </a>
              </td>
            </Row>
          ) : null}
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  ) : null;
}

const StackTraceWrapper = styled('td')`
  .traceback {
    margin-bottom: 0;
    border: 0;
  }
`;

const StackTraceTitle = styled('td')`
  font-weight: 600;
  font-size: 13px;
  width: 175px;
`;
