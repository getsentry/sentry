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

import {DEFAULT_FIELD} from '../common/settings';

import {ThresholdsIndicator} from './thresholdsIndicator';

export interface BigNumberWidgetVisualizationProps {
  value: number;
  field?: string;
  maximumValue?: number;
  meta?: Meta;
  preferredPolarity?: Polarity;
  previousPeriodValue?: number;
  thresholds?: Thresholds;
}

export function BigNumberWidgetVisualization(props: BigNumberWidgetVisualizationProps) {
  const {
    field = DEFAULT_FIELD,
    value,
    previousPeriodValue,
    maximumValue = Number.MAX_VALUE,
    preferredPolarity,
    meta,
  } = props;

  const location = useLocation();
  const organization = useOrganization();

  // TODO: meta as MetaType is a white lie. `MetaType` doesn't know that types can be null, but they can!
  const fieldRenderer =
    meta && field
      ? getFieldRenderer(field, meta as MetaType, false)
      : renderableValue => renderableValue.toString();

  const doesValueHitMaximum = maximumValue ? value >= maximumValue : false;
  const clampedValue = Math.min(value, maximumValue);

  const unit = meta?.units?.[field];
  const type = meta?.fields?.[field];

  const baggage = {
    location,
    organization,
    unit: unit ?? undefined, // TODO: Field formatters think units can't be null but they can
  };

  return (
    <Wrapper>
      <NumberAndDifferenceContainer>
        {props.thresholds && (
          <ThresholdsIndicator
            preferredPolarity={props.preferredPolarity}
            thresholds={props.thresholds}
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

function Wrapper({children}) {
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
