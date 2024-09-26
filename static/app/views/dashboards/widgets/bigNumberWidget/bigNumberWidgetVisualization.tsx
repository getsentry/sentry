import styled from '@emotion/styled';

import type {Polarity} from 'sentry/components/percentChange';
import {Tooltip} from 'sentry/components/tooltip';
import {defined} from 'sentry/utils';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldRenderer} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import {DifferenceToPreviousPeriodData} from 'sentry/views/dashboards/widgets/bigNumberWidget/differenceToPreviousPeriodData';
import {
  DEEMPHASIS_COLOR_NAME,
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
  meta?: Meta;
  preferredPolarity?: Polarity;
  previousPeriodData?: TableData;
}

export function BigNumberWidgetVisualization(props: Props) {
  const {data, previousPeriodData, preferredPolarity, meta, isLoading, error} = props;

  const location = useLocation();
  const organization = useOrganization();

  if (error) {
    return <ErrorPanel error={error} />;
  }

  // Big Number widgets only show one number, so we only ever look at the first item in the Discover response
  const datum = data?.[0];
  // TODO: Instrument getting more than one data key back as an error

  if (isLoading || !defined(data) || !defined(datum) || Object.keys(datum).length === 0) {
    return (
      <AutoResizeParent>
        <AutoSizedText>
          <Deemphasize>{NO_DATA_PLACEHOLDER}</Deemphasize>
        </AutoSizedText>
      </AutoResizeParent>
    );
  }

  const fields = Object.keys(datum);
  const field = fields[0];

  // TODO: meta as MetaType is a white lie. `MetaType` doesn't know that types can be null, but they can!
  const fieldRenderer = meta
    ? getFieldRenderer(field, meta as MetaType, false)
    : value => value.toString();

  const unit = meta?.units?.[field];
  const baggage = {
    location,
    organization,
    unit: unit ?? undefined, // TODO: Field formatters think units can't be null but they can
  };

  const rendered = fieldRenderer(datum, baggage);

  return (
    <AutoResizeParent>
      <AutoSizedText>
        <NumberAndDifferenceContainer>
          <NumberContainerOverride>
            <Tooltip title={datum[field]} isHoverable delay={0}>
              {rendered}
            </Tooltip>
          </NumberContainerOverride>

          {previousPeriodData && (
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
      </AutoSizedText>
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
