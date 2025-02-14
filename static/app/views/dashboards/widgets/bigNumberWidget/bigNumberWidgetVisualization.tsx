import styled from '@emotion/styled';

import type {Polarity} from 'sentry/components/percentChange';
import {Tooltip} from 'sentry/components/tooltip';
import {defined} from 'sentry/utils';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import {DifferenceToPreviousPeriodValue} from 'sentry/views/dashboards/widgets/bigNumberWidget/differenceToPreviousPeriodValue';
import type {
  Meta,
  TableData,
  Thresholds,
} from 'sentry/views/dashboards/widgets/common/types';

import {NON_FINITE_NUMBER_MESSAGE} from '../common/settings';

import {ThresholdsIndicator} from './thresholdsIndicator';

export interface BigNumberWidgetVisualizationProps {
  field: string;
  value: number | string;
  maximumValue?: number;
  meta?: Meta;
  preferredPolarity?: Polarity;
  previousPeriodValue?: number | string;
  thresholds?: Thresholds;
}

export function BigNumberWidgetVisualization(props: BigNumberWidgetVisualizationProps) {
  const {
    field,
    value,
    previousPeriodValue,
    maximumValue = Number.MAX_VALUE,
    preferredPolarity,
    meta,
  } = props;

  if ((typeof value === 'number' && !Number.isFinite(value)) || Number.isNaN(value)) {
    throw new Error(NON_FINITE_NUMBER_MESSAGE);
  }

  const location = useLocation();
  const organization = useOrganization();

  // TODO: meta as MetaType is a white lie. `MetaType` doesn't know that types can be null, but they can!
  const fieldRenderer = meta
    ? getFieldRenderer(field, meta as MetaType, false)
    : (renderableValue: any) => renderableValue.toString();

  const unit = meta?.units?.[field];
  const type = meta?.fields?.[field];

  const baggage = {
    location,
    organization,
    unit: unit ?? undefined, // TODO: Field formatters think units can't be null but they can
  };

  // String values don't support differences, thresholds, max values, or anything else.
  if (typeof value === 'string') {
    return (
      <Wrapper>
        <NumberAndDifferenceContainer>
          {fieldRenderer(
            {
              [field]: value,
            },
            baggage
          )}
        </NumberAndDifferenceContainer>
      </Wrapper>
    );
  }

  const doesValueHitMaximum = maximumValue ? value >= maximumValue : false;
  const clampedValue = Math.min(value, maximumValue);

  return (
    <Wrapper>
      <NumberAndDifferenceContainer>
        {defined(props.thresholds?.max_values.max1) &&
          defined(props.thresholds?.max_values.max2) && (
            <ThresholdsIndicator
              preferredPolarity={props.preferredPolarity}
              thresholds={{
                unit: props.thresholds.unit ?? undefined,
                max_values: {
                  max1: props.thresholds.max_values.max1,
                  max2: props.thresholds.max_values.max2,
                },
              }}
              unit={unit ?? ''}
              value={clampedValue}
              type={type ?? 'integer'}
            />
          )}

        <NumberContainerOverride>
          <Tooltip
            title={value}
            isHoverable
            delay={0}
            disabled={doesValueHitMaximum}
            containerDisplayMode="inline-flex"
          >
            {doesValueHitMaximum ? '>' : ''}
            {fieldRenderer(
              {
                [field]: clampedValue,
              },
              baggage
            )}
          </Tooltip>
        </NumberContainerOverride>

        {defined(previousPeriodValue) &&
          typeof previousPeriodValue === 'number' &&
          Number.isFinite(previousPeriodValue) &&
          !Number.isNaN(previousPeriodValue) &&
          !doesValueHitMaximum && (
            <DifferenceToPreviousPeriodValue
              value={value}
              previousPeriodValue={previousPeriodValue}
              field={field}
              preferredPolarity={preferredPolarity}
              renderer={(previousDatum: TableData[number]) =>
                fieldRenderer(previousDatum, baggage)
              }
            />
          )}
      </NumberAndDifferenceContainer>
    </Wrapper>
  );
}

function Wrapper({children}: any) {
  return (
    <AutoResizeParent>
      <AutoSizedText>{children}</AutoSizedText>
    </AutoResizeParent>
  );
}

const AutoResizeParent = styled('div')`
  position: absolute;
  inset: 0;

  color: ${p => p.theme.headingColor};

  container-type: size;
  container-name: auto-resize-parent;

  * {
    line-height: 1;
    text-align: left !important;
  }
`;

const NumberAndDifferenceContainer = styled('div')`
  display: flex;
  align-items: flex-end;
  gap: min(8px, 3cqw);
`;

const NumberContainerOverride = styled('div')`
  display: inline-flex;

  * {
    text-overflow: clip !important;
    display: inline;
    white-space: nowrap;
  }
`;
