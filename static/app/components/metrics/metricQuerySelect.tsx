import {useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {
  CompactSelect,
  type SelectOption,
  type SelectOptionOrSection,
  type SelectSection,
} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {Tooltip} from 'sentry/components/tooltip';
import {IconProject, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {MetricsExtractionCondition, MRI} from 'sentry/types/metrics';
import {BUILT_IN_CONDITION_ID} from 'sentry/utils/metrics/extractionRules';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {useCardinalityLimitedMetricVolume} from 'sentry/utils/metrics/useCardinalityLimitedMetricVolume';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

interface Props {
  mri: MRI;
  onChange: (conditionId: number) => void;
  conditionId?: number;
}

export function MetricQuerySelect({onChange, conditionId, mri}: Props) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {getConditions, getExtractionRule} = useVirtualMetricsContext();
  const {data: cardinality} = useCardinalityLimitedMetricVolume(pageFilters.selection);

  const {projects} = useProjects();

  const isCardinalityLimited = (condition?: MetricsExtractionCondition): boolean => {
    if (!cardinality || !condition) {
      return false;
    }
    return condition.mris.some(conditionMri => cardinality[conditionMri] > 0);
  };

  const spanConditions = getConditions(mri);
  const selectedCondition = spanConditions.find(c => c.id === conditionId);
  const hasBuiltInCondition = spanConditions.some(c => c.id === BUILT_IN_CONDITION_ID);

  const hasMultipleProjects =
    pageFilters.selection.projects.length > 1 ||
    pageFilters.selection.projects[0] === -1 ||
    pageFilters.selection.projects.length === 0;

  // If the selected condition cannot be found, select the first condition
  useEffect(() => {
    if (!selectedCondition && spanConditions.length > 0) {
      onChange(spanConditions[0].id);
    }
  }, [onChange, selectedCondition, spanConditions]);

  const options: SelectOptionOrSection<number>[] = useMemo(() => {
    let builtInOption: SelectOption<number> | null = null;
    const sectionMap = new Map<number, SelectOption<number>[]>();

    spanConditions
      .toSorted((a, b) => a.value.localeCompare(b.value))
      .forEach(condition => {
        const projectId = getExtractionRule(mri, condition.id)?.projectId!;
        if (condition.id === BUILT_IN_CONDITION_ID) {
          builtInOption = {
            label: t('All Spans'),
            value: condition.id,
          };
          return;
        }
        const section = sectionMap.get(projectId) ?? [];
        section.push({
          label: condition.value ? (
            <FormattedCondition condition={condition} />
          ) : (
            t('All Spans')
          ),
          textValue: condition.value || t('All Spans'),
          value: condition.id,
        });
        sectionMap.set(projectId, section);
      });

    const sections: SelectSection<number>[] = Array.from(sectionMap.entries())
      .map(([projectId, sectionOption]) => {
        const project = projects.find(p => p.id === String(projectId));
        return {
          options: sectionOption,
          sortKey: project?.slug ?? '',
          label: <ProjectBadge project={project!} avatarSize={12} disableLink />,
        };
      })
      .toSorted((a, b) => a.sortKey.localeCompare(b.sortKey));

    const allSections = builtInOption
      ? [
          {
            label: (
              <span
                style={{
                  display: 'inline-flex',
                  gap: space(0.5),
                }}
              >
                <IconProject key="generic-project" size="xs" /> {t('Built-in')}
              </span>
            ),
            options: [builtInOption],
          },
          ...sections,
        ]
      : sections;

    return allSections.length === 1 ? allSections[0].options : allSections;
  }, [getExtractionRule, mri, projects, spanConditions]);

  const istMetricQueryCardinalityLimited = isCardinalityLimited(
    spanConditions.find(c => c.id === conditionId)
  );

  let leadingIcon: React.ReactNode = null;
  if (conditionId && (hasMultipleProjects || hasBuiltInCondition)) {
    const project = projects.find(
      p => p.id === String(getExtractionRule(mri, conditionId)?.projectId)
    );

    if (conditionId === BUILT_IN_CONDITION_ID) {
      leadingIcon = <IconProject key="generic-project" size="xs" />;
    } else if (project) {
      leadingIcon = (
        <ProjectBadge
          project={project}
          key={project.slug}
          avatarSize={12}
          disableLink
          hideName
        />
      );
    }
  }

  if (istMetricQueryCardinalityLimited) {
    leadingIcon = <CardinalityWarningIcon />;
  }

  if (hasMetricsNewInputs(organization)) {
    return (
      <QueryFieldGroup.CompactSelect
        size="md"
        triggerLabel={
          selectedCondition?.value ? (
            <FormattedCondition condition={selectedCondition} />
          ) : (
            t('All Spans')
          )
        }
        triggerProps={{
          icon: leadingIcon,
        }}
        searchable
        options={options}
        value={conditionId}
        onChange={({value}) => {
          onChange(value);
        }}
        css={css`
          && {
            width: auto;
            min-width: auto;
            & > button {
              min-height: 100%;
            }
          }
        `}
      />
    );
  }

  return (
    <CompactSelect
      size="md"
      triggerProps={{
        prefix: t('Query'),
        icon: istMetricQueryCardinalityLimited ? <CardinalityWarningIcon /> : null,
      }}
      options={options}
      value={conditionId}
      onChange={({value}) => {
        onChange(value);
      }}
    />
  );
}

export function CardinalityWarningIcon() {
  return (
    <Tooltip
      isHoverable
      title={t(
        "This query is exeeding the cardinality limit. Remove tags or add more filters in the metric's settings to receive accurate data."
      )}
      skipWrapper
    >
      <IconWarning
        size="xs"
        color="yellow300"
        role="image"
        aria-label={t('Exceeding the cardinality limit warning')}
      />
    </Tooltip>
  );
}

function parseConditionValue(condition?: MetricsExtractionCondition) {
  if (condition?.value) {
    try {
      return parseSearch(condition.value);
    } catch {
      // Ignore
    }
  }
  return null;
}

function FormattedCondition({condition}: {condition?: MetricsExtractionCondition}) {
  const parsed = useMemo(() => parseConditionValue(condition), [condition]);

  if (!parsed) {
    return condition?.value;
  }

  return (
    <Tooltip
      overlayStyle={{maxWidth: '80vw'}}
      delay={500}
      title={
        <CompleteHighlight>
          <HighlightQuery parsedQuery={parsed} />
        </CompleteHighlight>
      }
    >
      <Highlight>
        <HighlightQuery parsedQuery={parsed} />
      </Highlight>
    </Tooltip>
  );
}

const Highlight = styled('span')`
  padding: ${space(0.5)} ${space(0.25)};
  overflow: hidden;
  font-size: ${p => p.theme.fontSizeSmall};
  gap: ${space(1)};
  color: ${p => p.theme.textColor};
  display: flex;
  white-space: nowrap;
  font-family: ${p => p.theme.text.familyMono};
  font-weight: 400;
  max-width: 350px;
  & span {
    margin: 0;
  }
`;

const CompleteHighlight = styled(Highlight)`
  display: flex;
  flex-wrap: wrap;
  max-width: unset;
`;
