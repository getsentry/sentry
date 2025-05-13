import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {ProfilePreview} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {MissingInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/missingInstrumentationNode';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {TraceDrawerComponents} from './styles';
import {getProfileMeta} from './utils';

export function MissingInstrumentationNodeDetails(
  props: TraceTreeNodeDetailsProps<MissingInstrumentationNode>
) {
  const {projects} = useProjects();

  const {node, organization, onTabScrollToNode} = props;
  const event = node.previous.event ?? node.next.event ?? null;
  const project = projects.find(proj => proj.slug === event?.projectSlug);
  const profileMeta = getProfileMeta(event) || '';
  const profileId =
    typeof profileMeta === 'string' ? profileMeta : profileMeta.profiler_id;

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
            'It looks like there’s more than 100ms unaccounted for. This might be a missing service or just idle time. If you know there’s something going on, you can [customInstrumentationLink: add more spans using custom instrumentation].',
            {
              customInstrumentationLink: (
                <ExternalLink href={getCustomInstrumentationLink(project)} />
              ),
            }
          )}
        </p>
        {event?.projectSlug ? (
          <ProfilesProvider
            orgSlug={organization.slug}
            projectSlug={event?.projectSlug ?? ''}
            profileMeta={profileMeta}
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
        <p>
          {t("If you'd prefer, you can also turn the feature off in the settings above.")}
        </p>
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
