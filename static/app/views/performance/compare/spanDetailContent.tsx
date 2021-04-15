import React from 'react';
import map from 'lodash/map';

import DateTime from 'app/components/dateTime';
import {Tags} from 'app/components/events/interfaces/spans/spanDetail';
import {rawSpanKeys, SpanType} from 'app/components/events/interfaces/spans/types';
import {DetailsContent, DetailsTableRow} from 'app/components/waterfallTree/details';
import {t} from 'app/locale';
import getDynamicText from 'app/utils/getDynamicText';

type Props = {
  span: Readonly<SpanType>;
};

const SpanDetailContent = (props: Props) => {
  const {span} = props;

  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;

  const duration = (endTimestamp - startTimestamp) * 1000;
  const durationString = `${duration.toFixed(3)}ms`;

  const unknownKeys = Object.keys(span).filter(key => {
    return !rawSpanKeys.has(key as any);
  });

  return (
    <DetailsContent>
      <table className="table key-value">
        <tbody>
          <DetailsTableRow title={t('Span ID')}>{span.span_id}</DetailsTableRow>
          <DetailsTableRow title={t('Parent Span ID')}>
            {span.parent_span_id || ''}
          </DetailsTableRow>
          <DetailsTableRow title={t('Trace ID')}>{span.trace_id}</DetailsTableRow>
          <DetailsTableRow title={t('Description')}>
            {span?.description ?? ''}
          </DetailsTableRow>
          <DetailsTableRow title={t('Start Date')}>
            {getDynamicText({
              fixed: 'Mar 16, 2020 9:10:12 AM UTC',
              value: (
                <React.Fragment>
                  <DateTime date={startTimestamp * 1000} />
                  {` (${startTimestamp})`}
                </React.Fragment>
              ),
            })}
          </DetailsTableRow>
          <DetailsTableRow title={t('End Date')}>
            {getDynamicText({
              fixed: 'Mar 16, 2020 9:10:13 AM UTC',
              value: (
                <React.Fragment>
                  <DateTime date={endTimestamp * 1000} />
                  {` (${endTimestamp})`}
                </React.Fragment>
              ),
            })}
          </DetailsTableRow>
          <DetailsTableRow title={t('Duration')}>{durationString}</DetailsTableRow>
          <DetailsTableRow title={t('Operation')}>{span.op || ''}</DetailsTableRow>
          <DetailsTableRow title={t('Same Process as Parent')}>
            {String(!!span.same_process_as_parent)}
          </DetailsTableRow>
          <Tags span={span} />
          {map(span?.data ?? {}, (value, key) => (
            <DetailsTableRow title={key} key={key}>
              {JSON.stringify(value, null, 4) || ''}
            </DetailsTableRow>
          ))}
          {unknownKeys.map(key => (
            <DetailsTableRow title={key} key={key}>
              {JSON.stringify(span[key], null, 4) || ''}
            </DetailsTableRow>
          ))}
        </tbody>
      </table>
    </DetailsContent>
  );
};

export default SpanDetailContent;
