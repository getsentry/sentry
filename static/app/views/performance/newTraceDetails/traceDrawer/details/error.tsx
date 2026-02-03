import {useMemo} from 'react';

import {t} from 'sentry/locale';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {ErrorNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/errorNode';

import {IssueList} from './issues/issues';
import {TraceDrawerComponents} from './styles';

export function ErrorNodeDetails(props: TraceTreeNodeDetailsProps<ErrorNode>) {
  const {node, organization, onTabScrollToNode} = props;
  const issues = useMemo(() => {
    return [...node.errors];
  }, [node.errors]);

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
      <TraceDrawerComponents.BodyContainer>
        {t(
          'This error is related to an ongoing issue. For details about how many users this affects and more, go to the issue below.'
        )}
        <IssueList issues={issues} node={node} organization={organization} />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
