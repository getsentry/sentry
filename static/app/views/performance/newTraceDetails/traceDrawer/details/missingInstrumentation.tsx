import {useTheme} from '@emotion/react';

import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useProjects from 'sentry/utils/useProjects';
import {ProfilePreview} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {getTraceTabTitle} from 'sentry/views/performance/newTraceDetails/traceState/traceTabs';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {
  makeTraceNodeBarColor,
  type MissingInstrumentationNode,
} from '../../traceModels/traceTree';

import {type SectionCardKeyValueList, TraceDrawerComponents} from './styles';

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

  const items: SectionCardKeyValueList = [
    {
      key: 'duration',
      subject: t('Duration'),
      value: getDuration(node.value.timestamp - node.value.start_timestamp, 2, true),
    },
    {
      key: 'previous_span',
      subject: t('Previous Span'),
      value: `${node.previous.value.op} - ${node.previous.value.description}`,
    },
    {
      key: 'next_span',
      subject: t('Next Span'),
      value: `${node.next.value.op} - ${node.next.value.description}`,
    },
  ];

  if (profileId && project?.slug) {
    items.push({
      key: 'profile_id',
      subject: 'Profile ID',
      value: (
        <TraceDrawerComponents.CopyableCardValueWithLink
          value={profileId}
          linkTarget={generateProfileFlamechartRouteWithQuery({
            orgSlug: organization.slug,
            projectSlug: project.slug,
            profileId,
          })}
          linkText={t('View Profile')}
        />
      ),
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

      <TraceDrawerComponents.SectionCard items={items} title={t('General')} />
    </TraceDrawerComponents.DetailContainer>
  );
}
