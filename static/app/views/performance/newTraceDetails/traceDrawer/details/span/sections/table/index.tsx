import {Fragment} from 'react';
import styled from '@emotion/styled';

import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import type {Organization} from 'sentry/types/organization';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

import {AncestryAndGrouping} from './rows/ancestry';
import {SpanDescription} from './rows/description';
import {DurationSummary} from './rows/duration';
import {SpanHTTPInfo} from './rows/http';
import {SpanKeys} from './rows/keys';
import {Tags} from './rows/tags';

type SpanDetailProps = {
  node: TraceTreeNode<TraceTree.Span>;
  onParentClick: (node: TraceTreeNode<TraceTree.NodeValue>) => void;
  openPanel: string | undefined;
  organization: Organization;
};

function SpanNodeDetailTable(props: SpanDetailProps) {
  const location = useLocation();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === props.node.value.event.projectID);
  const {organization} = props;
  const span = props.node.value;

  return (
    <Fragment>
      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          <ProfileLink node={props.node} project={project} />
          <SpanDescription
            node={props.node}
            organization={organization}
            location={location}
          />
          <DurationSummary node={props.node} />
          <SpanHTTPInfo span={span} />
          <AncestryAndGrouping
            node={props.node}
            organization={organization}
            location={location}
            onParentClick={props.onParentClick}
          />
          <Tags span={span} />
          <SpanKeys node={props.node} />
        </tbody>
      </TraceDrawerComponents.Table>
    </Fragment>
  );
}

function ProfileLink({
  node,
  project,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  project: Project | undefined;
}) {
  const {event} = node.value;
  const profileId = event.contexts.profile?.profile_id || '';
  return profileId && project?.slug ? (
    <TraceDrawerComponents.TableRow
      title="Profile ID"
      extra={
        <TransactionToProfileButton
          size="xs"
          projectSlug={project.slug}
          event={event}
          query={{
            spanId: node.value.span_id,
          }}
        >
          {t('View Profile')}
        </TransactionToProfileButton>
      }
    >
      {profileId}
    </TraceDrawerComponents.TableRow>
  ) : null;
}
export const ButtonGroup = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

export default SpanNodeDetailTable;
