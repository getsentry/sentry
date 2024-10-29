import {Fragment, memo, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {InputGroup} from 'sentry/components/inputGroup';
import LoadingError from 'sentry/components/loadingError';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {organizationSamplingForm} from 'sentry/views/settings/dynamicSampling/utils/organizationSamplingForm';
import {balanceSampleRate} from 'sentry/views/settings/dynamicSampling/utils/rebalancing';
import {useProjectSampleCounts} from 'sentry/views/settings/dynamicSampling/utils/useProjectSampleCounts';

const {useFormField} = organizationSamplingForm;

interface Props {
  period: '24h' | '30d';
}

export function ProjectsPreviewTable({period}: Props) {
  const [tableSort, setTableSort] = useState<'asc' | 'desc'>('desc');
  const {value: targetSampleRate, initialValue: initialTargetSampleRate} =
    useFormField('targetSampleRate');

  const {data, isPending, isError, refetch} = useProjectSampleCounts({period});

  const debouncedTargetSampleRate = useDebouncedValue(
    targetSampleRate,
    // For longer lists we debounce the input to avoid too many re-renders
    data.length > 100 ? 200 : 0
  );

  const {balancedItems} = useMemo(() => {
    const targetRate = Math.min(100, Math.max(0, Number(debouncedTargetSampleRate) || 0));
    return balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items: data,
    });
  }, [debouncedTargetSampleRate, data]);

  const initialSampleRatesBySlug = useMemo(() => {
    const targetRate = Math.min(100, Math.max(0, Number(initialTargetSampleRate) || 0));
    const {balancedItems: initialBalancedItems} = balanceSampleRate({
      targetSampleRate: targetRate / 100,
      items: data,
    });
    return initialBalancedItems.reduce((acc, item) => {
      acc[item.id] = item.sampleRate;
      return acc;
    }, {});
  }, [initialTargetSampleRate, data]);

  const handleTableSort = useCallback(() => {
    setTableSort(value => (value === 'asc' ? 'desc' : 'asc'));
  }, []);

  if (isError) {
    return <LoadingError onRetry={refetch} />;
  }

  return (
    <ProjectsTable
      stickyHeaders
      emptyMessage={t('No active projects found in the selected period.')}
      isEmpty={!data.length}
      isLoading={isPending}
      headers={[
        t('Project'),
        t('Spans'),
        <SortableHeader key="spans" onClick={handleTableSort}>
          {t('Total Spans')}
          <IconArrow direction={tableSort === 'desc' ? 'down' : 'up'} size="xs" />
        </SortableHeader>,
        t('Projected Rate'),
      ]}
    >
      {balancedItems
        .toSorted((a, b) => {
          if (tableSort === 'asc') {
            return a.count - b.count;
          }
          return b.count - a.count;
        })
        .map(({id, project, count, ownCount, sampleRate, subProjects}) => (
          <TableRow
            key={id}
            project={project}
            count={count}
            ownCount={ownCount}
            sampleRate={sampleRate}
            initialSampleRate={initialSampleRatesBySlug[project.slug]}
            subProjects={subProjects}
          />
        ))}
    </ProjectsTable>
  );
}

interface SubProject {
  count: number;
  slug: string;
}

function getSubProjectContent(subProjects: SubProject[], isExpanded: boolean) {
  let subProjectContent: React.ReactNode = t('No distributed traces');
  if (subProjects.length > 0) {
    const truncatedSubProjects = subProjects.slice(0, MAX_PROJECTS_COLLAPSED);
    const overflowingProjects = subProjects.length - MAX_PROJECTS_COLLAPSED;
    const stringifiedSubProjects =
      truncatedSubProjects.map(p => p.slug).join(', ') +
      (overflowingProjects > 0 ? `, +${overflowingProjects} more` : '');

    subProjectContent = isExpanded
      ? subProjects.map(subProject => <div key={subProject.slug}>{subProject.slug}</div>)
      : stringifiedSubProjects;
  }

  return subProjectContent;
}

function getSubSpansContent(subProjects: SubProject[], isExpanded: boolean) {
  let subSpansContent: React.ReactNode = '+0';
  if (subProjects.length > 0) {
    const subProjectSum = subProjects.reduce(
      (acc, subProject) => acc + subProject.count,
      0
    );

    subSpansContent = isExpanded
      ? subProjects.map(subProject => (
          <div key={subProject.slug}>+{formatAbbreviatedNumber(subProject.count, 2)}</div>
        ))
      : `+${formatAbbreviatedNumber(subProjectSum, 2)}`;
  }

  return subSpansContent;
}

const MAX_PROJECTS_COLLAPSED = 3;
const TableRow = memo(function TableRow({
  project,
  count,
  ownCount,
  sampleRate,
  initialSampleRate,
  subProjects,
}: {
  count: number;
  initialSampleRate: number;
  ownCount: number;
  project: Project;
  sampleRate: number;
  subProjects: SubProject[];
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasSubProjects = subProjects.length > 0;

  const subProjectContent = getSubProjectContent(subProjects, isExpanded);
  const subSpansContent = getSubSpansContent(subProjects, isExpanded);

  return (
    <Fragment key={project.slug}>
      <Cell>
        <FirstCellLine data-has-chevron={hasSubProjects}>
          {hasSubProjects && (
            <StyledIconChevron
              role="button"
              aria-label={isExpanded ? t('Collapse') : t('Expand')}
              direction={isExpanded ? 'down' : 'right'}
              onClick={() => setIsExpanded(value => !value)}
            />
          )}
          <ProjectBadge project={project} avatarSize={16} />
        </FirstCellLine>
        <SubProjects>{subProjectContent}</SubProjects>
      </Cell>
      <Cell>
        <FirstCellLine data-align="right">
          {formatAbbreviatedNumber(ownCount, 2)}
        </FirstCellLine>
        <SubSpans>{subSpansContent}</SubSpans>
      </Cell>
      <Cell>
        <FirstCellLine data-align="right">
          {formatAbbreviatedNumber(count, 2)}
        </FirstCellLine>
      </Cell>
      <Cell>
        <FirstCellLine>
          <Tooltip
            title={t('To edit project sample rates, switch to manual sampling mode.')}
          >
            <InputGroup
              css={css`
                width: 150px;
              `}
            >
              <InputGroup.Input
                disabled
                size="sm"
                value={formatNumberWithDynamicDecimalPoints(sampleRate * 100, 3)}
              />
              <InputGroup.TrailingItems>
                <TrailingPercent>%</TrailingPercent>
              </InputGroup.TrailingItems>
            </InputGroup>
          </Tooltip>
        </FirstCellLine>
        {sampleRate !== initialSampleRate && (
          <SmallPrint>
            {t(
              'previous: %s%%',
              formatNumberWithDynamicDecimalPoints(initialSampleRate * 100, 3)
            )}
          </SmallPrint>
        )}
      </Cell>
    </Fragment>
  );
});

const ProjectsTable = styled(PanelTable)`
  grid-template-columns: 1fr max-content max-content max-content;
`;

const SmallPrint = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  line-height: 1.5;
  text-align: right;
`;

const SortableHeader = styled('button')`
  border: none;
  background: none;
  cursor: pointer;
  display: flex;
  text-transform: inherit;
  align-items: center;
  gap: ${space(0.5)};
`;

const Cell = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.25)};
`;

const FirstCellLine = styled('div')`
  display: flex;
  align-items: center;
  height: 32px;
  &[data-align='right'] {
    justify-content: flex-end;
  }
  &[data-has-chevron='false'] {
    padding-left: ${space(2)};
  }
`;

const SubProjects = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  margin-left: ${space(2)};
  & > div {
    line-height: 2;
    margin-right: -${space(2)};
    padding-right: ${space(2)};
    margin-left: -${space(1)};
    padding-left: ${space(1)};
    border-top-left-radius: ${p => p.theme.borderRadius};
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    &:nth-child(odd) {
      background: ${p => p.theme.backgroundSecondary};
    }
  }
`;

const SubSpans = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: right;
  & > div {
    line-height: 2;
    margin-left: -${space(2)};
    padding-left: ${space(2)};
    margin-right: -${space(1)};
    padding-right: ${space(1)};
    border-top-right-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
    &:nth-child(odd) {
      background: ${p => p.theme.backgroundSecondary};
    }
  }
`;

const StyledIconChevron = styled(IconChevron)`
  height: 12px;
  width: 12px;
  margin-right: ${space(0.5)};
  color: ${p => p.theme.subText};
  cursor: pointer;
`;

const TrailingPercent = styled('strong')`
  padding: 0 ${space(0.25)}px;
`;
