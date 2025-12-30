import {useMemo} from 'react';

import {ExternalLink} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {useTransaction} from 'sentry/views/performance/newTraceDetails/traceApi/useTransaction';
import {getCustomInstrumentationLink} from 'sentry/views/performance/newTraceDetails/traceConfigurations';
import {ProfilePreview} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/profiling/profilePreview';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {NoInstrumentationNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/noInstrumentationNode';
import {ProfileGroupProvider} from 'sentry/views/profiling/profileGroupProvider';
import {ProfileContext, ProfilesProvider} from 'sentry/views/profiling/profilesProvider';

import {TraceDrawerComponents} from './styles';
import {getProfileMeta} from './utils';

export function MissingInstrumentationNodeDetails({
  ...props
}: TraceTreeNodeDetailsProps<NoInstrumentationNode>) {
  const {node} = props;
  const {projects} = useProjects();
  const previous = node.previous;

  const {data: eventTransaction = null} = useTransaction({
    event_id: previous.transactionId ?? '',
    organization: props.organization,
    project_slug: previous.projectSlug ?? '',
  });

  const profileMeta = useMemo(
    () => getProfileMeta(eventTransaction) || '',
    [eventTransaction]
  );

  const project = projects.find(proj => proj.slug === eventTransaction?.projectSlug);
  const profileContext = eventTransaction?.contexts?.profile ?? {};

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
          organization={props.organization}
          onTabScrollToNode={props.onTabScrollToNode}
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
        {eventTransaction ? (
          <ProfilesProvider
            orgSlug={props.organization.slug}
            projectSlug={eventTransaction?.projectSlug ?? ''}
            profileMeta={profileMeta || ''}
          >
            <ProfileContext.Consumer>
              {profiles => (
                <ProfileGroupProvider
                  type="flamechart"
                  input={profiles?.type === 'resolved' ? profiles.data : null}
                  traceID={profileContext.profile_id ?? ''}
                >
                  <ProfilePreview
                    project={project}
                    profileID={profileContext.profile_id ?? ''}
                    profilerID={profileContext.profiler_id ?? ''}
                    event={eventTransaction}
                    missingInstrumentationNode={node}
                  />
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
