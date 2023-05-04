import {Fragment, MouseEvent} from 'react';
import queryString from 'query-string';

import {Button} from 'sentry/components/button';
import ObjectInspector from 'sentry/components/objectInspector';
import {IconShow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {
  Indent,
  keyValueTableOrNotFound,
  SectionItem,
  SizeTooltip,
  Warning,
} from 'sentry/views/replays/detail/network/details/components';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';
import type {NetworkSpan} from 'sentry/views/replays/types';

export type SectionProps = {
  item: NetworkSpan;
  onScrollToRow: () => void;
  projectId: string;
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
    [t('Method')]: item.data?.method ?? '',
    [t('Status Code')]: item.data?.statusCode ?? '',
    [t('Request Body Size')]: (
      <SizeTooltip>{formatBytesBase10(item.data?.request?.size ?? 0)}</SizeTooltip>
    ),
    [t('Response Body Size')]: (
      <SizeTooltip>{formatBytesBase10(item.data?.response?.size ?? 0)}</SizeTooltip>
    ),
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
      {keyValueTableOrNotFound(data, t('Missing request details'))}
    </SectionItem>
  );
}

export function RequestHeadersSection({item}: SectionProps) {
  return (
    <SectionItem title={t('Request Headers')}>
      {keyValueTableOrNotFound(item.data?.request?.headers, t('Headers not captured'))}
    </SectionItem>
  );
}

export function ResponseHeadersSection({item}: SectionProps) {
  return (
    <SectionItem title={t('Response Headers')}>
      {keyValueTableOrNotFound(item.data?.request?.headers, t('Headers not captured'))}
    </SectionItem>
  );
}

export function QueryParamsSection({item}: SectionProps) {
  const queryParams = queryString.parse(item.description?.split('?')?.[1] ?? '');
  return (
    <SectionItem title={t('Query String Parameters')}>
      <Indent>
        <ObjectInspector data={queryParams} expandLevel={3} showCopyButton />
      </Indent>
    </SectionItem>
  );
}

export function RequestPayloadSection({item}: SectionProps) {
  const hasRequest = 'request' in item.data;
  return (
    <SectionItem
      title={t('Request Payload')}
      titleExtra={
        <SizeTooltip>
          {t('Size:')} {formatBytesBase10(item.data?.request?.size ?? 0)}
        </SizeTooltip>
      }
    >
      <Indent>
        <Warning warnings={item.data?.request?._meta?.warnings} />
        {hasRequest ? (
          <ObjectInspector data={item.data.request.body} expandLevel={2} showCopyButton />
        ) : (
          tct('Request body not found.', item.data)
        )}
      </Indent>
    </SectionItem>
  );
}

export function ResponsePayloadSection({item}: SectionProps) {
  const hasResponse = 'response' in item.data;

  return (
    <SectionItem
      title={t('Response Body')}
      titleExtra={
        <SizeTooltip>
          {t('Size:')} {formatBytesBase10(item.data?.response?.size ?? 0)}
        </SizeTooltip>
      }
    >
      <Indent>
        <Warning warnings={item.data?.response?._meta?.warnings} />
        {hasResponse ? (
          <ObjectInspector
            data={item.data.response.body}
            expandLevel={2}
            showCopyButton
          />
        ) : (
          tct('Response body not found.', item.data)
        )}
      </Indent>
    </SectionItem>
  );
}
