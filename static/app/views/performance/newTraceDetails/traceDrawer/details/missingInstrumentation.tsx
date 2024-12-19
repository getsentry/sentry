import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconSpan} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDuration from 'sentry/utils/duration/getDuration';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useProjects from 'sentry/utils/useProjects';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {getCustomInstrumentationLink} from '../../traceConfigurations';
import {ProfilePreview} from '../../traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from '../../traceDrawer/tabs/traceTreeNodeDetails';
import type {MissingInstrumentationNode} from '../../traceModels/missingInstrumentationNode';
import {TraceTree} from '../../traceModels/traceTree';
import {makeTraceNodeBarColor} from '../../traceRow/traceBar';
import {getTraceTabTitle} from '../../traceState/traceTabs';
import {useHasTraceNewUi} from '../../useHasTraceNewUi';

import {type SectionCardKeyValueList, TraceDrawerComponents} from './styles';

export function MissingInstrumentationNodeDetails(
  props: TraceTreeNodeDetailsProps<MissingInstrumentationNode>
) {
  const {projects} = useProjects();
  const hasTraceNewUi = useHasTraceNewUi();

  if (!hasTraceNewUi) {
    return <LegacyMissingInstrumentationNodeDetails {...props} />;
  }

  const {node, organization, onTabScrollToNode} = props;
  const event = node.previous.event ?? node.next.event ?? null;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileId = event?.contexts?.profile?.profile_id ?? null;

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('No Instrumentation')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              hideCopyButton
              text={t('How Awkward')}
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
        <TextBlock>
          {tct(
            'It looks like there’s more than 100ms unaccounted for. This might be a missing service or just idle time. If you know there’s something going on, you can [customInstrumentationLink: add more spans using custom instrumentation].',
            {
              customInstrumentationLink: (
                <ExternalLink href={getCustomInstrumentationLink(project)} />
              ),
            }
          )}
        </TextBlock>

        {event?.projectSlug ? (
          <ProfilesProvider
            orgSlug={organization.slug}
            projectSlug={event?.projectSlug ?? ''}
            profileId={profileId || ''}
          >
            <ProfileContext.Consumer>
              {profiles => (
                <ProfileGroupProvider
                  type="flamechart"
                  input={profiles?.type === 'resolved' ? profiles.data : null}
                  traceID={profileId || ''}
                >
                  <ProfilePreview event={event!} node={node} />
                </ProfileGroupProvider>
              )}
            </ProfileContext.Consumer>
          </ProfilesProvider>
        ) : null}

        <TextBlock>
          {t(
            "You can turn off the 'No Instrumentation' feature using the settings dropdown above."
          )}
        </TextBlock>
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}

const TextBlock = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.5;
  margin-bottom: ${space(2)};
`;

function LegacyMissingInstrumentationNodeDetails({
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
      <TraceDrawerComponents.BodyContainer>
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
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
