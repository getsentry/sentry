import {useTheme} from '@emotion/react';

import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useProjects from 'sentry/utils/useProjects';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {ProfilePreview} from '../../traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from '../../traceDrawer/tabs/traceTreeNodeDetails';
import type {MissingInstrumentationNode} from '../../traceModels/missingInstrumentationNode';
import {TraceTree} from '../../traceModels/traceTree';
import {makeTraceNodeBarColor} from '../../traceRow/traceBar';
import {getTraceTabTitle} from '../../traceState/traceTabs';

import {type SectionCardKeyValueList, TraceDrawerComponents} from './styles';

export function MissingInstrumentationNodeDetails({
  node,
  onParentClick,
  onTabScrollToNode,
  organization,
}: TraceTreeNodeDetailsProps<MissingInstrumentationNode>) {
  const theme = useTheme();
  const {projects} = useProjects();

  const parentTransaction = TraceTree.ParentTransaction(node);
  const event = node.previous.event ?? node.next.event ?? null;
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
      <TraceDrawerComponents.LegacyHeaderContainer>
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
      </TraceDrawerComponents.LegacyHeaderContainer>

      {node.event?.projectSlug ? (
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={node.event?.projectSlug ?? ''}
          profileId={profileId || ''}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId || ''}
              >
                <ProfilePreview event={node.event!} node={node} />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
      ) : null}

      <TraceDrawerComponents.SectionCard items={items} title={t('General')} />
    </TraceDrawerComponents.DetailContainer>
  );
}
