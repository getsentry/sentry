import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DateTime} from 'sentry/components/dateTime';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {getShortEventId} from 'sentry/utils/events';
import type {CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  isContinuousProfileReference,
  isTransactionProfileReference,
} from 'sentry/utils/profiling/guards/profile';
import {generateProfileRouteFromProfileReference} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useFlamegraph} from 'sentry/views/profiling/flamegraphProvider';

interface AggregateFlamegraphSidePanelProps {
  scheduler: CanvasScheduler;
}

export function AggregateFlamegraphSidePanel({
  scheduler,
}: AggregateFlamegraphSidePanelProps) {
  const organization = useOrganization();
  const {projects} = useProjects();

  const projectsLookupTable = useMemo(() => {
    return projects.reduce(
      (acc, project) => {
        acc[project.id] = project;
        return acc;
      },
      {} as Record<string, Project>
    );
  }, [projects]);

  const flamegraph = useFlamegraph();

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

    const seen: Set<Profiling.ProfileReference> = new Set();

    const allExamples = [];

    for (const node of referenceNodes) {
      for (const example of node.profileIds || []) {
        if (seen.has(example)) {
          continue;
        }
        seen.add(example);
        allExamples.push({example, node});
      }
    }

    return [...allExamples].sort(
      (a, b) => getReferenceStart(b.example) - getReferenceStart(a.example)
    );
  }, [flamegraph, frame]);

  return (
    <AggregateFlamegraphSidePanelContainer>
      <div>
        <Title>{t('Function')}</Title>
        <FrameInformation frame={frame} />
      </div>
      <div>
        <Title>
          {tct('Profiles ([count])', {
            count: examples.length,
          })}
        </Title>
        {examples.length <= 0 ? (
          <EmptyStateWarning withIcon={false} small>
            <div>{t('No profiles detected')}</div>
          </EmptyStateWarning>
        ) : (
          examples.map(({example}, index) => (
            <ProfileReferenceRow
              key={index}
              frame={frame}
              reference={example}
              organization={organization}
              projectsLookupTable={projectsLookupTable}
            />
          ))
        )}
      </div>
    </AggregateFlamegraphSidePanelContainer>
  );
}

interface FrameInformationProps {
  frame: FlamegraphFrame | null;
}

function FrameInformation({frame}: FrameInformationProps) {
  if (!defined(frame)) {
    return (
      <EmptyStateWarning withIcon={false} small>
        <div>{t('No function selected')}</div>
      </EmptyStateWarning>
    );
  }

  return (
    <FunctionContainer>
      <FunctionRowContainer>
        <div>{t('Name')}</div>
        <DetailsContainer>
          <Tooltip showOnlyOnOverflow title={frame.frame.name}>
            <code>{frame.frame.name}</code>
          </Tooltip>
        </DetailsContainer>
      </FunctionRowContainer>
      <FunctionRowContainer>
        <div>{t('Source')}</div>
        <DetailsContainer>
          <Tooltip showOnlyOnOverflow title={frame.frame.getSourceLocation()}>
            <code>{frame.frame.getSourceLocation()}</code>
          </Tooltip>
        </DetailsContainer>
      </FunctionRowContainer>
      <FunctionRowContainer>
        <span>{t('Type')}</span>
        <code>
          {frame.frame.is_application ? t('Application Frame') : t('System Frame')}
        </code>
      </FunctionRowContainer>
    </FunctionContainer>
  );
}

interface ProfileReferenceRowProps {
  frame: FlamegraphFrame | null;
  organization: Organization;
  projectsLookupTable: Record<string, Project>;
  reference: Profiling.ProfileReference;
}

function ProfileReferenceRow(props: ProfileReferenceRowProps) {
  const project =
    typeof props.reference !== 'string' && 'project_id' in props.reference
      ? props.projectsLookupTable[props.reference.project_id]
      : undefined;

  if (!project) {
    return null;
  }

  const target = generateProfileRouteFromProfileReference({
    organization: props.organization,
    projectSlug: project.slug,
    reference: props.reference,
    frameName: props.frame?.frame?.name,
    framePackage: props.frame?.frame?.package,
  });

  if (isTransactionProfileReference(props.reference)) {
    return (
      <ReferenceRowContainer>
        <Link to={target}>{getShortEventId(props.reference.profile_id)}</Link>
        {props.reference.start ? (
          <DateTime date={props.reference.start * 1000} />
        ) : (
          '\u2013'
        )}
      </ReferenceRowContainer>
    );
  }

  if (isContinuousProfileReference(props.reference)) {
    return (
      <ReferenceRowContainer>
        <Link to={target}>{getShortEventId(props.reference.profiler_id)}</Link>
        <DateTime date={props.reference.start * 1000} />
      </ReferenceRowContainer>
    );
  }

  return (
    <ReferenceRowContainer>
      <Link to={target}>{getShortEventId(props.reference)}</Link>
      {'\u2013'}
    </ReferenceRowContainer>
  );
}

function getReferenceStart(reference: Profiling.ProfileReference): number {
  if (isTransactionProfileReference(reference) && reference.start) {
    return reference.start;
  }

  if (isContinuousProfileReference(reference)) {
    return reference.start;
  }

  return 0;
}

const AggregateFlamegraphSidePanelContainer = styled('div')`
  flex-direction: column;
  width: 360px;
  padding: ${space(1)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  padding: ${space(1)};
`;

const RowContainer = styled('div')`
  border-radius: ${space(0.5)};
  padding: ${space(0.5)} ${space(1)};
  :nth-child(even) {
    background-color: ${p => p.theme.backgroundSecondary};
  }
  color: ${p => p.theme.subText};
  background-color: ${p => p.theme.tokens.background.primary};
  box-shadow: inset 0 0 0 1px transparent;
`;

const FunctionContainer = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${space(0.5)};
`;

const FunctionRowContainer = styled(RowContainer)`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

const DetailsContainer = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ReferenceRowContainer = styled(RowContainer)`
  display: flex;
  justify-content: space-between;
`;
