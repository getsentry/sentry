import {Fragment, MouseEvent} from 'react';
import queryString from 'query-string';

import {Button} from 'sentry/components/button';
import {IconShow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {
  keyValueTablOrNotFound,
  objectInspectorOrNotFound,
  SectionItem,
} from 'sentry/views/replays/detail/network/details/components';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

export type SectionProps = {
  item: NetworkSpan;
  onScrollToRow: () => void;
  startTimestampMs: number;
};

export function GeneralSection({item, onScrollToRow, startTimestampMs}: SectionProps) {
  const {handleClick} = useCrumbHandlers(startTimestampMs);

  const startMs = item.startTimestamp * 1000;
  const endMs = item.endTimestamp * 1000;

  const data = {
    [t('URL')]: (
      <Fragment>
        {item.description}
        <Button
          aria-label={t('Scroll into view')}
          borderless
          icon={<IconShow color="gray500" size="xs" />}
          onClick={onScrollToRow}
          size="xs"
        />
      </Fragment>
    ),
    [t('Type')]: item.op,
    [t('Method')]: item.data.method,
    [t('Status Code')]: item.data.statusCode,
    [t('Request Body Size')]: formatBytesBase10(item.data.request?.size ?? 0),
    [t('Response Body Size')]: formatBytesBase10(item.data.response?.size ?? 0),
    [t('Duration')]: `${(endMs - startMs).toFixed(2)}ms`,
    [t('Timestamp')]: (
      <TimestampButton
        format="mm:ss.SSS"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          handleClick(item);
        }}
        startTimestampMs={startTimestampMs}
        timestampMs={startMs}
      />
    ),
  };

  return (
    <SectionItem title={t('General')}>
      {keyValueTablOrNotFound(data, t('Missing request details'))}
    </SectionItem>
  );
}

export function RequestHeadersSection({item}: SectionProps) {
  return (
    <SectionItem title={t('Request Headers')}>
      {keyValueTablOrNotFound(item.data.request?.headers, t('Headers not captured'))}
    </SectionItem>
  );
}

export function ResponseHeadersSection({item}: SectionProps) {
  return (
    <SectionItem title={t('Response Headers')}>
      {keyValueTablOrNotFound(item.data.request?.headers, t('Headers not captured'))}
    </SectionItem>
  );
}

export function QueryParamsSection({item}: SectionProps) {
  const queryParams = queryString.parse(item.description?.split('?')?.[1] ?? '');
  return (
    <SectionItem title={t('Query String Parameters')}>
      {objectInspectorOrNotFound(queryParams, t('Query Params not found'))}
    </SectionItem>
  );
}

export function RequestPayloadSection({item}: SectionProps) {
  return (
    <SectionItem title={t('Request Payload')}>
      {objectInspectorOrNotFound(item.data?.request?.body, t('Request Body not found'))}
    </SectionItem>
  );
}

export function ResponsePayloadSection({item}: SectionProps) {
  return (
    <SectionItem title={t('Response Body')}>
      {objectInspectorOrNotFound(item.data?.response?.body, t('Response body not found'))}
    </SectionItem>
  );
}
