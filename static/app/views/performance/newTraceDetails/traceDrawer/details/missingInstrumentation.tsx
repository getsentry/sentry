import {useTheme} from '@emotion/react';

import {TransactionToProfileButton} from 'sentry/components/profiling/transactionToProfileButton';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import useProjects from 'sentry/utils/useProjects';
import {ProfilePreview} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {Row} from 'sentry/views/performance/traceDetails/styles';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {
  makeTraceNodeBarColor,
  type MissingInstrumentationNode,
} from '../../traceModels/traceTree';

import {TraceDrawerComponents} from './styles';

export function MissingInstrumentationNodeDetails({
  node,
  onParentClick,
  onTabScrollToNode,
  organization,
}: TraceTreeNodeDetailsProps<MissingInstrumentationNode>) {
  const theme = useTheme();
  const {projects} = useProjects();

  const parentTransaction = node.parent_transaction;
  const event = node.previous.value.event || node.next.value.event || null;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.IconTitleWrapper>
            <TraceDrawerComponents.IconBorder
              backgroundColor={makeTraceNodeBarColor(theme, node)}
            >
              <IconSpan size="md" />
            </TraceDrawerComponents.IconBorder>
            <div style={{fontWeight: 'bold'}}>{t('Missing Instrumentation')}</div>
          </TraceDrawerComponents.IconTitleWrapper>
        </TraceDrawerComponents.Title>
        <TraceDrawerComponents.NodeActions
          organization={organization}
          node={node}
          onTabScrollToNode={onTabScrollToNode}
        />
      </TraceDrawerComponents.HeaderContainer>
      {event.projectSlug ? (
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
                <ProfilePreview event={event} node={node} />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}
      <TraceDrawerComponents.Table className="table key-value">
        <tbody>
          {parentTransaction ? (
            <Row title="Parent Transaction">
              <td className="value">
                <a onClick={() => onParentClick(parentTransaction)}>
                  {getTraceTabTitle(parentTransaction)}
                </a>
              </td>
            </Row>
          ) : null}
          <Row title={t('Duration')}>
            {getDuration(node.value.timestamp - node.value.start_timestamp, 2, true)}
          </Row>
          {profileId && project?.slug && (
            <Row
              title="Profile ID"
              extra={
                <TransactionToProfileButton
                  size="xs"
                  projectSlug={project.slug}
                  event={event}
                >
                  {t('View Profile')}
                </TransactionToProfileButton>
              }
            >
              {profileId}
            </Row>
          )}
          <Row title={t('Previous Span')}>
            {node.previous.value.op} - {node.previous.value.description}
          </Row>
          <Row title={t('Next Span')}>
            {node.next.value.op} - {node.next.value.description}
          </Row>
        </tbody>
      </TraceDrawerComponents.Table>
    </TraceDrawerComponents.DetailContainer>
  );
}
