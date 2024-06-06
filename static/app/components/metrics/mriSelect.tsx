import {memo, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {ComboBox} from 'sentry/components/comboBox';
import type {ComboBoxOption} from 'sentry/components/comboBox/types';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {MetricMeta, MRI} from 'sentry/types/metrics';
import {
  isCustomMetric,
  isSpanDuration,
  isSpanMeasurement,
  isTransactionDuration,
  isTransactionMeasurement,
} from 'sentry/utils/metrics';
import {getReadableMetricType} from 'sentry/utils/metrics/formatters';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import useKeyPress from 'sentry/utils/useKeyPress';
import useProjects from 'sentry/utils/useProjects';
import {MetricListItemDetails} from 'sentry/views/metrics/metricListItemDetails';

type MRISelectProps = {
  isLoading: boolean;
  metricsMeta: MetricMeta[];
  onChange: (mri: MRI) => void;
  onOpenMenu: (isOpen: boolean) => void;
  onTagClick: (mri: MRI, tag: string) => void;
  projects: number[];
  value: MRI;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const metricName = parseMRI(metric.mri)?.name;
    if (!metricName) {
      continue;
    }

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

export const MRISelect = memo(function MRISelect({
  projects: projectIds,
  onChange,
  onTagClick,
  onOpenMenu,
  metricsMeta,
  isLoading,
  value,
}: MRISelectProps) {
  const {projects} = useProjects();
  const mriMode = useMriMode();

  const metricsWithDuplicateNames = useMetricsWithDuplicateNames(metricsMeta);

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
      const parsedMri = parseMRI(value)!;
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
    option => {
      onChange(option.value);
    },
    [onChange]
  );

  const mriOptions = useMemo(
    () =>
      displayedMetrics.map<ComboBoxOption<MRI>>(metric => {
        const isDuplicateWithDifferentUnit = metricsWithDuplicateNames.has(metric.mri);

        const trailingItems: React.ReactNode[] = [];
        if (isDuplicateWithDifferentUnit) {
          trailingItems.push(<IconWarning key="warning" size="xs" color="yellow400" />);
        }
        if (parseMRI(metric.mri)?.useCase === 'custom' && !mriMode) {
          trailingItems.push(
            <CustomMetricInfoText key="text">{t('Custom')}</CustomMetricInfoText>
          );
        }
        return {
          label: mriMode
            ? metric.mri
            : middleEllipsis(formatMRI(metric.mri) ?? '', 46, /\.|-|_/),
          textValue: mriMode
            ? // enable search by mri, name, unit (millisecond), type (c:), and readable type (counter)
              `${metric.mri}${getReadableMetricType(metric.type)}`
            : // enable search in the full formatted string
              formatMRI(metric.mri),
          value: metric.mri,
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
    [displayedMetrics, metricsWithDuplicateNames, mriMode, onTagClick, selectedProjects]
  );

  return (
    <MetricComboBox
      aria-label={t('Metric')}
      placeholder={t('Select a metric')}
      loadingMessage={t('Loading metrics...')}
      sizeLimit={100}
      size="md"
      menuSize="sm"
      isLoading={isLoading}
      onOpenChange={onOpenMenu}
      options={mriOptions}
      value={value}
      onChange={handleMRIChange}
      growingInput
      menuWidth="450px"
    />
  );
});

const CustomMetricInfoText = styled('span')`
  color: ${p => p.theme.subText};
`;

const MetricComboBox = styled(ComboBox)`
  min-width: 200px;
  max-width: min(500px, 100%);
`;
