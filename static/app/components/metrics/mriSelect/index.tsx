import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {ComboBox} from 'sentry/components/comboBox';
import type {ComboBoxOption} from 'sentry/components/comboBox/types';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {QueryFieldGroup} from 'sentry/components/metrics/queryFieldGroup';
import {IconProject, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {MetricMeta, MRI} from 'sentry/types/metrics';
import {type Fuse, useFuzzySearch} from 'sentry/utils/fuzzySearch';
import {
  isCustomMetric,
  isSpanDuration,
  isSpanMeasurement,
  isTransactionDuration,
  isTransactionMeasurement,
} from 'sentry/utils/metrics';
import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, isExtractedCustomMetric, parseMRI} from 'sentry/utils/metrics/mri';
import {useBreakpoints} from 'sentry/utils/metrics/useBreakpoints';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import useKeyPress from 'sentry/utils/useKeyPress';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {MetricListItemDetails} from './metricListItemDetails';

type MRISelectProps = {
  isLoading: boolean;
  metricsMeta: MetricMeta[];
  onChange: (mri: MRI) => void;
  onOpenMenu: (isOpen: boolean) => void;
  onTagClick: (mri: MRI, tag: string) => void;
  projects: number[];
  value: MRI;
  isModal?: boolean;
};

const isVisibleTransactionMetric = (metric: MetricMeta) =>
  isTransactionDuration(metric) || isTransactionMeasurement(metric);

const isVisibleSpanMetric = (metric: MetricMeta) =>
  isSpanDuration(metric) || isSpanMeasurement(metric);

const isShownByDefault = (metric: MetricMeta) =>
  isCustomMetric(metric) ||
  isVisibleTransactionMetric(metric) ||
  isVisibleSpanMetric(metric);

function useMriMode() {
  const [mriMode, setMriMode] = useState(false);
  const mriModeKeyPressed = useKeyPress('`', undefined, true);

  useEffect(() => {
    if (mriModeKeyPressed) {
      setMriMode(value => !value);
    }
  }, [mriModeKeyPressed]);

  return mriMode;
}

/**
 * Returns a set of MRIs that have duplicate names but different units
 */
export function getMetricsWithDuplicateNames(metrics: MetricMeta[]): Set<MRI> {
  const metricNameMap = new Map<string, MRI[]>();
  const duplicateNames: string[] = [];

  for (const metric of metrics) {
    const parsedMri = parseMRI(metric.mri);
    // Include the use case to avoid warning of conflicts between different use cases
    const metricName = `${parsedMri.type}_${parsedMri.useCase}_${parsedMri.name}`;

    if (metricNameMap.has(metricName)) {
      const mapEntry = metricNameMap.get(metricName);
      mapEntry?.push(metric.mri);
      duplicateNames.push(metricName);
    } else {
      metricNameMap.set(metricName, [metric.mri]);
    }
  }

  const duplicateMetrics = new Set<MRI>();
  for (const name of duplicateNames) {
    const duplicates = metricNameMap.get(name);
    if (!duplicates) {
      continue;
    }
    duplicates.forEach(duplicate => duplicateMetrics.add(duplicate));
  }

  return duplicateMetrics;
}

/**
 * Returns a set of MRIs that have duplicate names but different units
 */
function useMetricsWithDuplicateNames(metrics: MetricMeta[]): Set<MRI> {
  return useMemo(() => {
    return getMetricsWithDuplicateNames(metrics);
  }, [metrics]);
}

const SEARCH_OPTIONS: Fuse.IFuseOptions<any> = {
  keys: ['searchText'],
  threshold: 0.2,
  ignoreLocation: true,
  includeScore: false,
  includeMatches: false,
  minMatchCharLength: 1,
};

function useFilteredMRIs(
  metricsMeta: MetricMeta[],
  inputValue: string,
  mriMode: boolean
) {
  const searchEntries = useMemo(() => {
    return metricsMeta.map(metric => {
      return {
        value: metric.mri,
        searchText: mriMode
          ? // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
            `${getReadableMetricType(metric.type)}${metric.mri}`
          : // enable search in the full formatted string
            formatMRI(metric.mri),
      };
    });
  }, [metricsMeta, mriMode]);

  const search = useFuzzySearch(searchEntries, SEARCH_OPTIONS);

  return useMemo(() => {
    if (!search || !inputValue) {
      return new Set(metricsMeta.map(metric => metric.mri));
    }

    const results = search.search(inputValue);
    return new Set(results.map(result => result.item.value));
  }, [inputValue, metricsMeta, search]);
}

export const MRISelect = memo(function MRISelect({
  projects: projectIds,
  onChange,
  onTagClick,
  onOpenMenu,
  metricsMeta,
  isLoading,
  value,
  isModal,
}: MRISelectProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {projects} = useProjects();
  const mriMode = useMriMode();
  const [inputValue, setInputValue] = useState('');
  const breakpoints = useBreakpoints();

  const metricsWithDuplicateNames = useMetricsWithDuplicateNames(metricsMeta);
  const filteredMRIs = useFilteredMRIs(metricsMeta, inputValue, mriMode);

  // If the mri is not in the list of metrics, set it to the default metric
  const selectedMeta = metricsMeta.find(metric => metric.mri === value);
  useEffect(() => {
    if (!selectedMeta) {
      onChange(emptyMetricsQueryWidget.mri);
    }
  }, [onChange, selectedMeta]);

  const handleFilterOption = useCallback(
    (option: ComboBoxOption<MRI>) => {
      return filteredMRIs.has(option.value);
    },
    [filteredMRIs]
  );

  const selectedProjects = useMemo(
    () =>
      projects.filter(project =>
        projectIds[0] === -1
          ? true
          : projectIds.length === 0
            ? project.isMember
            : projectIds.includes(parseInt(project.id, 10))
      ),
    [projectIds, projects]
  );

  const displayedMetrics = useMemo(() => {
    const isSelected = (metric: MetricMeta) => metric.mri === value;
    const result = metricsMeta
      .filter(metric => isShownByDefault(metric) || isSelected(metric))
      .sort(metric => (isSelected(metric) ? -1 : 1));

    // Add the selected metric to the top of the list if it's not already there
    if (result[0]?.mri !== value) {
      const parsedMri = parseMRI(value);
      return [
        {
          mri: value,
          type: parsedMri.type,
          unit: parsedMri.unit,
          operations: [],
          projectIds: [],
          blockingStatus: [],
        } satisfies MetricMeta,
        ...result,
      ];
    }

    return result;
  }, [metricsMeta, value]);

  const handleMRIChange = useCallback(
    // @ts-expect-error TS(7006): Parameter 'option' implicitly has an 'any' type.
    option => {
      onChange(option.value);
    },
    [onChange]
  );

  const maxLength = useMemo(() => {
    if (breakpoints.small) {
      // at least small size screen, no problem with fitting 100 characters
      return 100;
    }
    if (breakpoints.xsmall) {
      return 35; // at least xsmall size screen, no problem with fitting 35 characters
    }

    // screen smaller than xsmall, 20 characters is optimal
    return 20;
  }, [breakpoints]);

  const mriOptions = useMemo(
    () =>
      displayedMetrics.map<ComboBoxOption<MRI>>(metric => {
        const parsedMRI = parseMRI(metric.mri);
        const isDuplicateWithDifferentUnit = metricsWithDuplicateNames.has(metric.mri);
        const isUnresolvedExtractedMetric = isExtractedCustomMetric(metric);
        const showProjectBadge = selectedProjects.length > 1;
        const projectToShow =
          selectedProjects.length > 1 && metric.projectIds.length === 1
            ? projects.find(p => metric.projectIds[0] === parseInt(p.id, 10))
            : undefined;

        let projectBadge: React.ReactNode = null;

        if (showProjectBadge) {
          projectBadge = projectToShow ? (
            <ProjectBadge
              project={projectToShow}
              key={projectToShow.slug}
              avatarSize={12}
              disableLink
              hideName
            />
          ) : (
            <IconProject key="generic-project" size="xs" />
          );
        }

        const trailingItems: React.ReactNode[] = [];
        if (isDuplicateWithDifferentUnit) {
          trailingItems.push(<IconWarning key="warning" size="xs" color="yellow400" />);
        }
        if (
          parsedMRI.useCase === 'custom' &&
          parsedMRI.type !== 'v' &&
          !isUnresolvedExtractedMetric &&
          !mriMode
        ) {
          trailingItems.push(
            <CustomMetricInfoText key="text">{t('Custom')}</CustomMetricInfoText>
          );
        }
        return {
          label: mriMode
            ? metric.mri
            : isUnresolvedExtractedMetric
              ? t('Deleted Metric')
              : middleEllipsis(formatMRI(metric.mri) ?? '', maxLength, /\.|-|_/),
          value: metric.mri,
          leadingItems: [projectBadge],
          disabled: isUnresolvedExtractedMetric,
          details:
            metric.projectIds.length > 0 ? (
              <MetricListItemDetails
                metric={metric}
                selectedProjects={selectedProjects}
                onTagClick={onTagClick}
                isDuplicateWithDifferentUnit={isDuplicateWithDifferentUnit}
              />
            ) : null,
          showDetailsInOverlay: true,
          trailingItems,
        };
      }),
    [
      displayedMetrics,
      metricsWithDuplicateNames,
      mriMode,
      onTagClick,
      projects,
      selectedProjects,
      maxLength,
    ]
  );

  if (hasMetricsNewInputs(organization)) {
    return (
      <QueryFieldGroup.ComboBox
        aria-label={t('Metric')}
        filterOption={option => handleFilterOption(option as ComboBoxOption<MRI>)}
        growingInput
        isLoading={isLoading}
        loadingMessage={t('Loading\u2026')}
        menuSize="sm"
        menuWidth="450px" // TODO(priscilawebdev): update this value for small screens
        onChange={handleMRIChange}
        onInputChange={setInputValue}
        onOpenChange={onOpenMenu}
        options={mriOptions}
        placeholder={t('Select a metric')}
        size="md"
        sizeLimit={100}
        value={value}
        css={
          !isModal
            ? css`
                @media (min-width: ${theme.breakpoints.xxlarge}) {
                  max-width: min(500px, 100%);
                }
              `
            : undefined
        }
      />
    );
  }

  return (
    <ComboBox
      aria-label={t('Metric')}
      filterOption={handleFilterOption}
      growingInput
      isLoading={isLoading}
      loadingMessage={t('Loading metrics...')}
      menuSize="sm"
      menuWidth="450px"
      onChange={handleMRIChange}
      onInputChange={setInputValue}
      onOpenChange={onOpenMenu}
      options={mriOptions}
      placeholder={t('Select a metric')}
      size="md"
      sizeLimit={100}
      value={value}
      css={css`
        min-width: 200px;
        max-width: min(500px, 100%);
      `}
    />
  );
});

const CustomMetricInfoText = styled('span')`
  color: ${p => p.theme.subText};
`;
