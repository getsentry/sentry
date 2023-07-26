import {MouseEvent, useEffect, useMemo} from 'react';
import queryString from 'query-string';

import ObjectInspector from 'sentry/components/objectInspector';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils';
import useCrumbHandlers from 'sentry/utils/replays/hooks/useCrumbHandlers';
import {
  getFrameMethod,
  getFrameStatus,
  isRequestFrame,
} from 'sentry/utils/replays/resourceFrame';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {
  Indent,
  keyValueTableOrNotFound,
  SectionItem,
  SizeTooltip,
  Warning,
} from 'sentry/views/replays/detail/network/details/components';
import {useDismissReqRespBodiesAlert} from 'sentry/views/replays/detail/network/details/onboarding';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

export type SectionProps = {
  item: SpanFrame;
  projectId: string;
  startTimestampMs: number;
};

const UNKNOWN_STATUS = 'unknown';

export function GeneralSection({item, startTimestampMs}: SectionProps) {
  const {handleClick} = useCrumbHandlers(startTimestampMs);

  const requestFrame = isRequestFrame(item) ? item : null;

  // TODO[replay]: what about:
  // `requestFrame?.data?.request?.size` vs. `requestFrame?.data?.requestBodySize`

  const data = {
    [t('URL')]: item.description,
    [t('Type')]: item.op,
    [t('Method')]: getFrameMethod(item),
    [t('Status Code')]: String(getFrameStatus(item) ?? UNKNOWN_STATUS),
    [t('Request Body Size')]: (
      <SizeTooltip>
        {formatBytesBase10(requestFrame?.data?.request?.size ?? 0)}
      </SizeTooltip>
    ),
    [t('Response Body Size')]: (
      <SizeTooltip>
        {formatBytesBase10(requestFrame?.data?.response?.size ?? 0)}
      </SizeTooltip>
    ),
    [t('Duration')]: `${(item.endTimestampMs - item.timestampMs).toFixed(2)}ms`,
    [t('Timestamp')]: (
      <TimestampButton
        format="mm:ss.SSS"
        onClick={(event: MouseEvent) => {
          event.stopPropagation();
          handleClick(item);
        }}
        startTimestampMs={startTimestampMs}
        timestampMs={item.timestampMs}
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
  const data = isRequestFrame(item) ? item.data : {};
  return (
    <SectionItem title={t('Request Headers')}>
      {keyValueTableOrNotFound(data.request?.headers, t('Headers not captured'))}
    </SectionItem>
  );
}

export function ResponseHeadersSection({item}: SectionProps) {
  const data = isRequestFrame(item) ? item.data : {};
  return (
    <SectionItem title={t('Response Headers')}>
      {keyValueTableOrNotFound(data.request?.headers, t('Headers not captured'))}
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
  const {dismiss, isDismissed} = useDismissReqRespBodiesAlert();

  const data = useMemo(() => (isRequestFrame(item) ? item.data : {}), [item]);
  useEffect(() => {
    if (!isDismissed && 'request' in data) {
      dismiss();
    }
  }, [dismiss, data, isDismissed]);

  return (
    <SectionItem
      title={t('Request Body')}
      titleExtra={
        <SizeTooltip>
          {t('Size:')} {formatBytesBase10(data.request?.size ?? 0)}
        </SizeTooltip>
      }
    >
      <Indent>
        <Warning warnings={data.request?._meta?.warnings} />
        {'request' in data ? (
          <ObjectInspector data={data.request?.body} expandLevel={2} showCopyButton />
        ) : (
          t('Request body not found.')
        )}
      </Indent>
    </SectionItem>
  );
}

export function ResponsePayloadSection({item}: SectionProps) {
  const {dismiss, isDismissed} = useDismissReqRespBodiesAlert();

  const data = useMemo(() => (isRequestFrame(item) ? item.data : {}), [item]);
  useEffect(() => {
    if (!isDismissed && 'response' in data) {
      dismiss();
    }
  }, [dismiss, data, isDismissed]);

  return (
    <SectionItem
      title={t('Response Body')}
      titleExtra={
        <SizeTooltip>
          {t('Size:')} {formatBytesBase10(data.response?.size ?? 0)}
        </SizeTooltip>
      }
    >
      <Indent>
        <Warning warnings={data?.response?._meta?.warnings} />
        {'response' in data ? (
          <ObjectInspector data={data.response?.body} expandLevel={2} showCopyButton />
        ) : (
          t('Response body not found.')
        )}
      </Indent>
    </SectionItem>
  );
}
