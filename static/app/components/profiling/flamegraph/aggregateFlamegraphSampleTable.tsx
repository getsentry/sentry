import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Link from 'sentry/components/links/link';
import {
  formatWeightToProfileDuration,
  PROFILING_SAMPLES_FORMATTER,
} from 'sentry/components/profiling/flamegraph/flamegraphTooltip';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import type {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useFlamegraph} from 'sentry/views/profiling/flamegraphProvider';

interface AggregateFlamegraphSampleTableProps {
  scheduler: CanvasScheduler;
}

export function AggregateFlamegraphSampleTable({
  scheduler,
}: AggregateFlamegraphSampleTableProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const flamegraph = useFlamegraph();

  const projectsLookupTable = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[project.id] = project;
        return acc;
      },
      {} as Record<string, Project>
    );
  }, [projects]);

  const [frame, setFrame] = useState<FlamegraphFrame | null>(null);

  useEffect(() => {
    function onFrameHighlight(
      frames: FlamegraphFrame[] | null,
      type: 'hover' | 'selected'
    ) {
      if (type === 'selected') {
        setFrame(frames?.[0] ?? null);
      }
    }

    scheduler.on('highlight frame', onFrameHighlight);

    return () => {
      scheduler.off('highlight frame', onFrameHighlight);
    };
  }, [scheduler]);

  const examples = useMemo(() => {
    const referenceNodes = frame ? [frame] : flamegraph.root.children;
    return referenceNodes
      .flatMap(n => n.profileIds?.map(example => ({example, node: n})) || [])
      .slice(0, 100);
  }, [flamegraph, frame]);

  return (
    <AggregateFlamegraphFunctionBreakdownContainer>
      <AggregateFlamegraphSectionHeader>
        {t('Function Information')}
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        <AggregateFlamegraphFunctionBreakdownHeader>
          {frame ? (
            <AggregateFlamegraphFunction
              frame={frame}
              flamegraph={flamegraph}
              organization={organization}
            />
          ) : (
            <AggregateFlamegraphRoot
              frames={flamegraph.root.children}
              flamegraph={flamegraph}
              organization={organization}
            />
          )}
        </AggregateFlamegraphFunctionBreakdownHeader>
      </AggregateFlamegraphSection>
      <AggregateFlamegraphSectionHeader>
        <Tooltip title={t('Example profiles where this function was called.')}>
          {tct('Profiles ([count])', {count: examples.length})}
        </Tooltip>
      </AggregateFlamegraphSectionHeader>
      <AggregateFlamegraphSection>
        {!examples.length ? (
          <AggregateFlamegraphFunctionBreakdownEmptyState>
            {t('No profiles detected.')}
          </AggregateFlamegraphFunctionBreakdownEmptyState>
        ) : (
          examples.map(({example, node: n}, i) => {
            return (
              <AggregateFlamegraphProfileReference
                key={i}
                frameName={n.frame.name}
                framePackage={n.frame.package}
                organization={organization}
                profile={example}
                projectsLookupTable={projectsLookupTable}
              />
            );
          })
        )}
      </AggregateFlamegraphSection>
    </AggregateFlamegraphFunctionBreakdownContainer>
  );
}

function AggregateFlamegraphRoot(props: {
  flamegraph: Flamegraph;
  frames: FlamegraphFrame[];
  organization: Organization;
}) {
  const totalWeight = props.frames.reduce(
    (weight, frame) => weight + frame.frame.totalWeight,
    0
  );
  return (
    <AggregateFlamegraphFunctionContainer>
      <AggregateFlamegraphFunctionName subtext>
        {t('Select a Function')}
      </AggregateFlamegraphFunctionName>
      <AggregateFlamegraphFunctionSubtext>
        <AggregateFlamegraphFunctionSource>
          {t('All functions')}
        </AggregateFlamegraphFunctionSource>
        <AggregateFlamegraphFunctionSamples>
          <div>
            {PROFILING_SAMPLES_FORMATTER.format(totalWeight)} {t('samples') + ' '}
            {`(${formatWeightToProfileDuration(totalWeight, props.flamegraph)})`}{' '}
          </div>
        </AggregateFlamegraphFunctionSamples>
      </AggregateFlamegraphFunctionSubtext>
    </AggregateFlamegraphFunctionContainer>
  );
}

function AggregateFlamegraphFunction(props: {
  flamegraph: Flamegraph;
  frame: FlamegraphFrame;
  organization: Organization;
}) {
  const source =
    (props.frame.frame.file ? `${props.frame.frame.getSourceLocation()}` : null) ??
    '<unknown>';

  return (
    <AggregateFlamegraphFunctionContainer>
      <AggregateFlamegraphFunctionName subtext={false}>
        <Tooltip title={props.frame.frame.name} showOnlyOnOverflow>
          {props.frame.frame.name}
        </Tooltip>
      </AggregateFlamegraphFunctionName>
      <AggregateFlamegraphFunctionSubtext>
        <AggregateFlamegraphFunctionSource>
          <Tooltip title={source} showOnlyOnOverflow>
            <TextOverflow>{source}</TextOverflow>
          </Tooltip>
        </AggregateFlamegraphFunctionSource>
        <AggregateFlamegraphFunctionSamples>
          <div>
            {PROFILING_SAMPLES_FORMATTER.format(props.frame.frame.totalWeight)}{' '}
            {t('samples') + ' '}
            {`(${formatWeightToProfileDuration(props.frame.node.totalWeight, props.flamegraph)})`}{' '}
          </div>
        </AggregateFlamegraphFunctionSamples>
      </AggregateFlamegraphFunctionSubtext>
    </AggregateFlamegraphFunctionContainer>
  );
}

function AggregateFlamegraphProfileReference(props: {
  frameName: string;
  framePackage: string | undefined;
  organization: Organization;
  profile: Profiling.ProfileReference;
  projectsLookupTable: Record<string, Project>;
}) {
  const project =
    typeof props.profile !== 'string' && 'project_id' in props.profile
      ? props.projectsLookupTable[props.profile.project_id]
      : undefined;

  if (!project) {
    return null;
  }

  const to = generateProfileRouteFromProfileReference({
    organization: props.organization,
    projectSlug: project.slug,
    reference: props.profile,
    frameName: props.frameName,
    framePackage: props.framePackage,
  });

  const reference =
    typeof props.profile === 'string'
      ? props.profile
      : 'profiler_id' in props.profile
        ? props.profile.profiler_id
        : props.profile.profile_id;

  return (
    <AggregateFlamegraphProfileReferenceContainer>
      <AggregateFlamegraphProfileReferenceProject>
        <ProjectAvatar project={project} />
        {project.slug}
      </AggregateFlamegraphProfileReferenceProject>
      <Link to={to}>
        <TextOverflow>{reference.substring(0, 8)}</TextOverflow>
        <IconOpen />
      </Link>
    </AggregateFlamegraphProfileReferenceContainer>
  );
}

const AggregateFlamegraphFunctionBreakdownContainer = styled('div')`
  flex-direction: column;
  width: 360px;
  border-left: 1px solid ${p => p.theme.border};
  overflow-y: scroll;
`;

const AggregateFlamegraphSectionHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.backgroundSecondary};
  padding: ${space(0.5)} ${space(1)};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeightBold};

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const AggregateFlamegraphSection = styled('div')`
  background: ${p => p.theme.background};

  & > :nth-child(even) {
    background: ${p => p.theme.backgroundSecondary};
  }
`;

const AggregateFlamegraphFunctionBreakdownHeader = styled('div')`
  width: 100%;
`;

const AggregateFlamegraphFunctionBreakdownEmptyState = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: ${p => p.theme.subText};
  text-align: center;
  padding: ${space(1)};
`;

const AggregateFlamegraphProfileReferenceContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: ${p => p.theme.text.family};
  gap: ${space(1)};
  padding: ${space(1)};

  a {
    display: flex;
    align-items: center;
    gap: ${space(0.5)};
    color: ${p => p.theme.textColor};
  }
`;

const AggregateFlamegraphProfileReferenceProject = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const AggregateFlamegraphFunctionContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  padding: ${space(1)};
`;

const AggregateFlamegraphFunctionName = styled('span')<{subtext: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: 0;
  border: none;
  background: none;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  text-align: left;
  ${p => p.subtext && `color: ${p.theme.subText};`}
`;

const AggregateFlamegraphFunctionSource = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
  margin-top: ${space(0.25)};
  font-size: ${p => p.theme.fontSizeSmall};
  min-width: 0;
  cursor: pointer;
  width: 100%;
`;

const AggregateFlamegraphFunctionSubtext = styled('div')`
  display: flex;
  align-items: flex-end;
`;

const AggregateFlamegraphFunctionSamples = styled('div')`
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  justify-content: space-between;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  white-space: nowrap;
  line-height: 1.2;
`;
