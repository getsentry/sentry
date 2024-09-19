import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import type {MetaType} from 'sentry/utils/discover/eventView';
import {getFieldFormatter} from 'sentry/utils/discover/fieldRenderers';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AutoSizedText} from 'sentry/views/dashboards/widgetCard/autoSizedText';
import {NO_DATA_PLACEHOLDER} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import type {Meta, TableData} from 'sentry/views/dashboards/widgets/common/types';

export interface Props {
  data?: TableData;
  meta?: Meta;
}

export function BigNumberWidgetVisualization(props: Props) {
  const {data, meta} = props;

  const location = useLocation();
  const organization = useOrganization();

  // Big Number widgets only show one number, so we only ever look at the first item in the Discover response
  const datum = data?.[0];
  // TODO: Instrument getting more than one data key back as an error

  if (!defined(datum) || Object.keys(datum).length === 0) {
    return <SensiblySizedText>{NO_DATA_PLACEHOLDER}</SensiblySizedText>;
  }

  const fields = Object.keys(datum);
  const field = fields[0];

  // TODO: meta as MetaType is a white lie. `MetaType` doesn't know that types can be null, but they can!
  const fieldFormatter = meta
    ? getFieldFormatter(field, meta as MetaType, false)
    : value => value.toString();

  const unit = meta?.units?.[field];
  const rendered = fieldFormatter(datum, {
    location,
    organization,
    unit: unit ?? undefined, // TODO: Field formatters think units can't be null but they can
  });

  return (
    <AutoResizeParent>
      <AutoSizedText>
        <NumberContainerOverride>
          <Tooltip title={rendered} showOnlyOnOverflow>
            {rendered}
          </Tooltip>
        </NumberContainerOverride>
      </AutoSizedText>
    </AutoResizeParent>
  );
}

const AutoResizeParent = styled('div')`
  position: absolute;
  color: ${p => p.theme.headingColor};
  inset: 0;

  * {
    line-height: 1;
    text-align: left !important;
  }
`;

const NumberContainerOverride = styled('div')`
  display: inline-block;

  * {
    text-overflow: clip !important;
    display: inline;
    white-space: nowrap;
  }
`;

const SensiblySizedText = styled('div')`
  line-height: 1;
  display: inline-flex;
  flex: 1;
  width: 100%;
  min-height: 0;
  font-size: 32px;
  color: ${p => p.theme.headingColor};
  padding: ${space(1)} ${space(3)} ${space(3)} ${space(3)};

  * {
    text-align: left !important;
  }
`;
