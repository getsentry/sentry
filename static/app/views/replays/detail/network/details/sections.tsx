import {MouseEvent, useEffect, useMemo} from 'react';
import queryString from 'query-string';

import ObjectInspector from 'sentry/components/objectInspector';
import {Flex} from 'sentry/components/profiling/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatBytesBase10} from 'sentry/utils';
import {
  NetworkMetaWarning,
  ReplayNetworkRequestOrResponse,
} from 'sentry/utils/replays/replay';
import {
  getFrameMethod,
  getFrameStatus,
  getReqRespContentTypes,
  isRequestFrame,
} from 'sentry/utils/replays/resourceFrame';
import type {SpanFrame} from 'sentry/utils/replays/types';
import {
  Indent,
  keyValueTableOrNotFound,
  KeyValueTuple,
  SectionItem,
  SizeTooltip,
  Warning,
} from 'sentry/views/replays/detail/network/details/components';
import {useDismissReqRespBodiesAlert} from 'sentry/views/replays/detail/network/details/onboarding';
import {fixJson} from 'sentry/views/replays/detail/network/truncateJson/fixJson';
import TimestampButton from 'sentry/views/replays/detail/timestampButton';

export type SectionProps = {
  item: SpanFrame;
  projectId: string;
  startTimestampMs: number;
};

const UNKNOWN_STATUS = 'unknown';

export function GeneralSection({item, startTimestampMs}: SectionProps) {
  const {setCurrentTime} = useReplayContext();

  const requestFrame = isRequestFrame(item) ? item : null;

  const data: KeyValueTuple[] = [
    {key: t('URL'), value: item.description},
    {key: t('Type'), value: item.op},
    {key: t('Method'), value: getFrameMethod(item)},
    {key: t('Status Code'), value: String(getFrameStatus(item) ?? UNKNOWN_STATUS)},
    {
      key: t('Request Body Size'),
      value: (
        <SizeTooltip>
          {formatBytesBase10(requestFrame?.data?.request?.size ?? 0)}
        </SizeTooltip>
      ),
    },
    {
      key: t('Response Body Size'),
      value: (
        <SizeTooltip>
          {formatBytesBase10(requestFrame?.data?.response?.size ?? 0)}
        </SizeTooltip>
      ),
    },
    {
      key: t('Duration'),
      value: `${(item.endTimestampMs - item.timestampMs).toFixed(2)}ms`,
    },
    {
      key: t('Timestamp'),
      value: (
        <TimestampButton
          format="mm:ss.SSS"
          onClick={(event: MouseEvent) => {
            event.stopPropagation();
            setCurrentTime(item.offsetMs);
          }}
          startTimestampMs={startTimestampMs}
          timestampMs={item.timestampMs}
        />
      ),
    },
  ];

  return (
    <SectionItem title={t('General')}>
      {keyValueTableOrNotFound(data, t('Missing request details'))}
    </SectionItem>
  );
}

export function RequestHeadersSection({item}: SectionProps) {
  const contentTypeHeaders = getReqRespContentTypes(item);
  const isContentTypeMismatched =
    contentTypeHeaders.req !== undefined &&
    contentTypeHeaders.resp !== undefined &&
    contentTypeHeaders.req !== contentTypeHeaders.resp;

  const data = isRequestFrame(item) ? item.data : {};
  const headers: KeyValueTuple[] = Object.entries(data.request?.headers || {}).map(
    ([key, value]) => {
      const warn = key === 'content-type' && isContentTypeMismatched;
      return {
        key,
        value: warn ? (
          <Flex align="center" gap={space(0.5)}>
            {value}
            <QuestionTooltip
              size="xs"
              title={t('The content-type of the request does not match the response.')}
            />
          </Flex>
        ) : (
          value
        ),
        type: warn ? 'warning' : undefined,
      };
    }
  );

  return (
    <SectionItem title={t('Request Headers')}>
      {keyValueTableOrNotFound(headers, t('Headers not captured'))}
    </SectionItem>
  );
}

export function ResponseHeadersSection({item}: SectionProps) {
  const contentTypeHeaders = getReqRespContentTypes(item);
  const isContentTypeMismatched =
    contentTypeHeaders.req !== undefined &&
    contentTypeHeaders.resp !== undefined &&
    contentTypeHeaders.req !== contentTypeHeaders.resp;

  const data = isRequestFrame(item) ? item.data : {};
  const headers: KeyValueTuple[] = Object.entries(data.response?.headers || {}).map(
    ([key, value]) => {
      const warn = key === 'content-type' && isContentTypeMismatched;
      return {
        key,
        value: warn ? (
          <Flex align="center" gap={space(0.5)}>
            {value}
            <QuestionTooltip
              size="xs"
              title={t('The content-type of the request does not match the response.')}
            />
          </Flex>
        ) : (
          value
        ),
        type: warn ? 'warning' : undefined,
        tooltip: undefined,
      };
    }
  );

  return (
    <SectionItem title={t('Response Headers')}>
      {keyValueTableOrNotFound(headers, t('Headers not captured'))}
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
  const {warnings, body} = getBodyAndWarnings(data.request);

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
        <Warning warnings={warnings} />
        {'request' in data ? (
          <ObjectInspector data={body} expandLevel={2} showCopyButton />
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
  const {warnings, body} = getBodyAndWarnings(data.response);

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
        <Warning warnings={warnings} />
        {'response' in data ? (
          <ObjectInspector data={body} expandLevel={2} showCopyButton />
        ) : (
          t('Response body not found.')
        )}
      </Indent>
    </SectionItem>
  );
}

function getBodyAndWarnings(reqOrRes?: ReplayNetworkRequestOrResponse): {
  body: ReplayNetworkRequestOrResponse['body'];
  warnings: NetworkMetaWarning[];
} {
  if (!reqOrRes) {
    return {body: undefined, warnings: []};
  }

  const warnings = reqOrRes._meta?.warnings ?? [];
  let body = reqOrRes.body;

  if (typeof body === 'string' && warnings.includes('MAYBE_JSON_TRUNCATED')) {
    try {
      const json = fixJson(body);
      body = JSON.parse(json);
      warnings.push('JSON_TRUNCATED');
    } catch {
      // this can fail, in which case we just use the body string
      warnings.push('INVALID_JSON');
      warnings.push('TEXT_TRUNCATED');
    }
  }

  return {body, warnings};
}
