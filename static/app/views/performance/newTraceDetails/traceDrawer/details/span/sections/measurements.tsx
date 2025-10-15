import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {
  getFieldTypeFromUnit,
  isNotMarkMeasurement,
  isNotPerformanceScoreMeasurement,
} from 'sentry/components/events/eventCustomPerformanceMetrics';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  DURATION_UNITS,
  FIELD_FORMATTERS,
  SIZE_UNITS,
} from 'sentry/utils/discover/fieldRenderers';
import {NumberContainer} from 'sentry/utils/discover/styles';
import {isCustomMeasurement} from 'sentry/views/dashboards/utils';
import {
  TraceDrawerComponents,
  type SectionCardKeyValueList,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {TraceDrawerActionValueKind} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {SpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/spanNode';

export function hasSpanMeasurements(span: TraceTree.Span) {
  return !!span.measurements && Object.keys(span.measurements).length > 0;
}

function Measurements({
  node,
  location,
  organization,
}: {
  location: Location;
  node: SpanNode;
  organization: Organization;
}) {
  const theme = useTheme();
  const {measurements} = node.value;
  const measurementNames: string[] = useMemo(() => {
    return Object.keys(measurements ?? {})
      .filter(name => isCustomMeasurement(`measurements.${name}`))
      .filter(isNotMarkMeasurement)
      .filter(isNotPerformanceScoreMeasurement)
      .sort();
  }, [measurements]);

  const projectID = node.event?.projectID;
  const items: SectionCardKeyValueList = useMemo(() => {
    const result = [];
    for (const name of measurementNames) {
      const {value, unit} = measurements?.[name] ?? {};
      if (defined(value)) {
        const fieldType = getFieldTypeFromUnit(unit);
        const renderValue = fieldType === 'string' ? `${value} ${unit}` : value;
        const rendered = fieldType
          ? FIELD_FORMATTERS[fieldType].renderFunc(
              name,
              {[name]: renderValue},
              {location, organization, unit, theme}
            )
          : renderValue;

        // Some custom perf metrics have units.
        // These custom perf metrics need to be adjusted to the correct value.
        let customMetricValue = value;
        if (typeof value === 'number' && unit && customMetricValue) {
          if (Object.keys(SIZE_UNITS).includes(unit)) {
            customMetricValue *= SIZE_UNITS[unit as keyof typeof SIZE_UNITS];
          } else if (Object.keys(DURATION_UNITS).includes(unit)) {
            customMetricValue *= DURATION_UNITS[unit as keyof typeof DURATION_UNITS];
          }
        }

        result.push({
          key: name,
          subject: name,
          value: rendered,
          actionButton: (
            <TraceDrawerComponents.KeyValueAction
              rowKey={name}
              rowValue={customMetricValue}
              kind={TraceDrawerActionValueKind.MEASUREMENT}
              projectIds={projectID}
            />
          ),
          actionButtonAlwaysVisible: true,
        });
      }
    }
    return result;
  }, [measurements, measurementNames, location, organization, projectID, theme]);

  if (measurementNames.length < 1) {
    return null;
  }

  return (
    <Wrapper>
      <TraceDrawerComponents.SectionCard
        items={items}
        title={t('Measurements')}
        sortAlphabetically
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  ${NumberContainer} {
    text-align: left;
  }
`;

export default Measurements;
