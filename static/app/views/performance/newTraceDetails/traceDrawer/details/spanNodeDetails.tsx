import styled from '@emotion/styled';

import NewTraceDetailsSpanDetail, {
  SpanDetailContainer,
  SpanDetails,
} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {
  getSpanOperation,
  parseTrace,
} from 'sentry/components/events/interfaces/spans/utils';
import {DataSection} from 'sentry/components/events/styles';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import useProjects from 'sentry/utils/useProjects';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import type {TraceTree, TraceTreeNode} from '../../traceTree';

export default function SpanNodeDetails({
  node,
  organization,
}: {
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const {projects} = useProjects();
  const {event, relatedErrors, childTxn, ...span} = node.value;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  return (
    <Wrapper>
      <Title>
        <Tooltip title={event.projectSlug}>
          <ProjectBadge
            project={project ? project : {slug: event.projectSlug || ''}}
            avatarSize={50}
            hideName
          />
        </Tooltip>
        <div>
          <div>{t('Span')}</div>
          <TransactionOp> {getSpanOperation(span)}</TransactionOp>
        </div>
      </Title>
      {event.projectSlug && (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={event.projectSlug}
          profileId={profileId || ''}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <NewTraceDetailsSpanDetail
                  relatedErrors={relatedErrors}
                  childTransactions={childTxn ? [childTxn] : []}
                  event={event}
                  openPanel="open"
                  organization={organization}
                  span={span}
                  trace={parseTrace(event)}
                />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: ${space(1)};

  ${DataSection} {
    padding: 0;
  }

  ${SpanDetails} {
    padding: 0;
  }

  ${SpanDetailContainer} {
    border-bottom: none !important;
  }
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const Title = styled(FlexBox)`
  gap: ${space(2)};
`;

const TransactionOp = styled('div')`
  font-size: 25px;
  font-weight: bold;
  max-width: 600px;
  ${p => p.theme.overflowEllipsis}
`;
