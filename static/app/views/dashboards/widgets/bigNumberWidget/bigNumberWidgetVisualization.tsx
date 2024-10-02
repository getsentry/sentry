import styled from '@emotion/styled';

import type {Polarity} from 'sentry/components/percentChange';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import {DifferenceToPreviousPeriodData} from 'sentry/views/dashboards/widgets/bigNumberWidget/differenceToPreviousPeriodData';
import {
  DEEMPHASIS_COLOR_NAME,
  LOADING_PLACEHOLDER,
  NO_DATA_PLACEHOLDER,
} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import {ErrorPanel} from 'sentry/views/dashboards/widgets/common/errorPanel';
import type {
  Meta,
  StateProps,
  TableData,
} from 'sentry/views/dashboards/widgets/common/types';

export interface Props extends StateProps {
  data?: TableData;
  maximumValue?: number;
  meta?: Meta;
  preferredPolarity?: Polarity;
  previousPeriodData?: TableData;
}

export function BigNumberWidgetVisualization(props: Props) {
  const {
    data,
    previousPeriodData,
    maximumValue = Number.MAX_VALUE,
    preferredPolarity,
    meta,
    isLoading,
    error,
  } = props;

  const location = useLocation();
  const organization = useOrganization();

  if (error) {
    return <ErrorPanel error={error} />;
  }

  // TODO: Instrument getting more than one data key back as an error
  // e.g., with data that looks like `[{'apdex()': 0.8}] this pulls out `"apdex()"` or `undefined`
  const field = Object.keys(data?.[0] ?? {})[0];
  const value = data?.[0]?.[field];

  if (isLoading) {
    return (
      <Wrapper>
        <Deemphasize>{LOADING_PLACEHOLDER}</Deemphasize>
      </Wrapper>
    );
  }

  if (!defined(value)) {
    return (
      <Wrapper>
        <Deemphasize>{NO_DATA_PLACEHOLDER}</Deemphasize>
      </Wrapper>
    );
  }

  if (!Number.isFinite(value) || error) {
    return <ErrorPanel error={t('Value is not a finite number.')} />;
  }

  const parsedValue = Number(value);

  // TODO: meta as MetaType is a white lie. `MetaType` doesn't know that types can be null, but they can!
  const fieldRenderer = meta
    ? getFieldRenderer(field, meta as MetaType, false)
    : renderableValue => renderableValue.toString();

  const doesValueHitMaximum = maximumValue ? parsedValue >= maximumValue : false;
  const clampedValue = Math.min(parsedValue, maximumValue);

  const datum = {
    [field]: clampedValue,
  };

  const unit = meta?.units?.[field];

  const baggage = {
    location,
    organization,
    unit: unit ?? undefined, // TODO: Field formatters think units can't be null but they can
  };

  const rendered = fieldRenderer(datum, baggage);

  return (
    <Wrapper>
      <NumberAndDifferenceContainer>
        <NumberContainerOverride>
          <Tooltip
            title={parsedValue}
            isHoverable
            delay={0}
            disabled={doesValueHitMaximum}
            containerDisplayMode="inline-flex"
          >
            {doesValueHitMaximum ? '>' : ''}
            {rendered}
          </Tooltip>
        </NumberContainerOverride>

        {data && previousPeriodData && !doesValueHitMaximum && (
          <DifferenceToPreviousPeriodData
            data={data}
            previousPeriodData={previousPeriodData}
            preferredPolarity={preferredPolarity}
            renderer={(previousDatum: TableData[number]) =>
              fieldRenderer(previousDatum, baggage)
            }
            field={field}
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

const Deemphasize = styled('span')`
  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
`;
