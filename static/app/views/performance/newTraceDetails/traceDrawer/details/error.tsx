import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {generateIssueEventTarget} from 'sentry/components/quickTrace/utils';
import {IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {EventError, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {Row, Tags} from 'sentry/views/performance/traceDetails/styles';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

import {TraceDrawerComponents} from './styles';

export function ErrorNodeDetails({
  node,
  organization,
  location,
  scrollToNode,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.TraceError>;
  organization: Organization;
  scrollToNode: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
}) {
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

  return isLoading ? (
    <LoadingIndicator />
  ) : data ? (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.IconTitleWrapper>
          <TraceDrawerComponents.IconBorder errored>
            <IconFire color="errorText" size="md" />
          </TraceDrawerComponents.IconBorder>
          <div style={{fontWeight: 'bold'}}>{t('Error')}</div>
        </TraceDrawerComponents.IconTitleWrapper>
        <TraceDrawerComponents.Actions>
          <Button size="xs" onClick={_e => scrollToNode(node)}>
            {t('Show in view')}
          </Button>
          <Button size="xs" to={generateIssueEventTarget(node.value, organization)}>
            {t('Go to Issue')}
          </Button>
        </TraceDrawerComponents.Actions>
      </TraceDrawerComponents.HeaderContainer>

      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          {stackTrace && (
            <tr>
              <StackTraceTitle>{t('Stack Trace')}</StackTraceTitle>
              <StackTraceWrapper>
                <StackTracePreviewContent event={data} stacktrace={stackTrace} />
              </StackTraceWrapper>
            </tr>
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
