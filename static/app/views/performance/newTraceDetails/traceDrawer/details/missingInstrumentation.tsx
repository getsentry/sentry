import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {ProfilePreview} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {isEAPSpanNode} from 'sentry/views/performance/newTraceDetails/traceGuards';
import type {MissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/missingInstrumentationNode';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {TraceDrawerComponents} from './styles';
import {getProfileMeta} from './utils';

interface BaseProps extends TraceTreeNodeDetailsProps<MissingInstrumentationNode> {
  event: EventTransaction | null;
  profileId: string | undefined;
  profileMeta: ReturnType<typeof getProfileMeta>;
  profilerId: string | undefined;
  project: Project | undefined;
}

export function MissingInstrumentationNodeDetails({
  ...props
}: TraceTreeNodeDetailsProps<MissingInstrumentationNode>) {
  const {node} = props;
  const {projects} = useProjects();

  if (isEAPSpanNode(node.previous)) {
    return <EAPMissingInstrumentationNodeDetails {...props} projects={projects} />;
  }

  const event = node.previous.event ?? node.next.event ?? null;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileMeta = getProfileMeta(event) || '';
  const profileContext = event?.contexts?.profile ?? {};

  return (
    <BaseMissingInstrumentationNodeDetails
      {...props}
      profileMeta={profileMeta}
      project={project}
      event={event}
      profileId={profileContext.profile_id}
      profilerId={profileContext.profiler_id}
    />
  );
}

function EAPMissingInstrumentationNodeDetails({
  projects,
  ...props
}: TraceTreeNodeDetailsProps<MissingInstrumentationNode> & {
  projects: Project[];
}) {
  const {node} = props;
  const previous = node.previous as TraceTreeNode<TraceTree.EAPSpan>;
  const parentEAPTransaction = TraceTree.ParentEAPTransaction(previous);

  const project = parentEAPTransaction
    ? projects.find(proj => proj.slug === parentEAPTransaction.value.project_slug)
    : undefined;
  const profileId = parentEAPTransaction?.value.profile_id || '';
  const profilerId = parentEAPTransaction?.value.profiler_id || '';

  return (
    <BaseMissingInstrumentationNodeDetails
      {...props}
      profileMeta={profileId}
      project={project}
      event={null}
      profileId={profileId}
      profilerId={profilerId}
    />
  );
}

function BaseMissingInstrumentationNodeDetails({
  node,
  organization,
  onTabScrollToNode,
  profileMeta,
  project,
  event,
  profileId,
  profilerId,
}: BaseProps) {
  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.LegacyTitleText>
            <TraceDrawerComponents.TitleText>
              {t('No Instrumentation')}
            </TraceDrawerComponents.TitleText>
            <TraceDrawerComponents.SubtitleWithCopyButton
              clipboardText=""
              subTitle={t('How Awkward')}
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
        <p>
          {tct(
            "It looks like there's more than 100ms unaccounted for. This might be a missing service or just idle time. If you know there's something going on, you can [customInstrumentationLink: add more spans using custom instrumentation].",
            {
              customInstrumentationLink: (
                <ExternalLink href={getCustomInstrumentationLink(project)} />
              ),
            }
          )}
        </p>
        <ProfilesProvider
          orgSlug={organization.slug}
          projectSlug={event?.projectSlug ?? ''}
          profileMeta={profileMeta || ''}
        >
          <ProfileContext.Consumer>
            {profiles => (
              <ProfileGroupProvider
                type="flamechart"
                input={profiles?.type === 'resolved' ? profiles.data : null}
                traceID={profileId ?? ''}
              >
                <ProfilePreview
                  project={project}
                  profileID={profileId}
                  profilerID={profilerId}
                  event={event}
                  node={node}
                />
              </ProfileGroupProvider>
            )}
          </ProfileContext.Consumer>
        </ProfilesProvider>
        <p>
          {t("If you'd prefer, you can also turn the feature off in the settings above.")}
        </p>
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
