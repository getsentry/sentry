import {useState} from 'react';
import {useTheme} from '@emotion/react';

import {Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

interface RequestWaterfallItem {
  durationUs: number;
  startUs: number;
}

export interface RequestWaterfallData {
  TcpConn: RequestWaterfallItem;
  dns: RequestWaterfallItem;
  firstByte: RequestWaterfallItem;
  receiveResponse: RequestWaterfallItem;
  sendRequest: RequestWaterfallItem;
  tlsHandshake: RequestWaterfallItem;
}

interface RequestWaterfallProps {
  data: RequestWaterfallData;
}

export function RequestWaterfall({data}: RequestWaterfallProps) {
  const theme = useTheme();

  // XXX(epurkhiser): We don't currently store the duration and start time as
  // microseconds, but we can infer from when the DNS request is made and
  // from the receiveResponse duration (which right now is the duration of
  // the entire request)
  const barProps = {
    requestStartUs: data.dns.startUs,
    requestTotalUs: data.receiveResponse.durationUs,
  };

  return (
    <Text size="sm">
      <Grid columns="max-content 1fr" gap="sm lg">
        <div>{t('Request')}</div>
        <WaterfallBar item={data.sendRequest} color={theme.purple300} {...barProps} />
        <div>{t('DNS Lookup')}</div>
        <WaterfallBar item={data.dns} color={theme.red300} {...barProps} />
        <div>{t('TCP Handshake')}</div>
        <WaterfallBar item={data.TcpConn} color={theme.blue300} {...barProps} />
        <div>{t('TLS Handshake')}</div>
        <WaterfallBar item={data.tlsHandshake} color={theme.green300} {...barProps} />
        <div>{t('Response')}</div>
        <WaterfallBar item={data.receiveResponse} color={theme.pink300} {...barProps} />
        <div>{t('First Byte')}</div>
        <WaterfallBar item={data.firstByte} color={theme.yellow300} {...barProps} />
      </Grid>
    </Text>
  );
}

interface WaterfallBarProps {
  color: string;
  item: RequestWaterfallItem;
  requestStartUs: number;
  requestTotalUs: number;
}

function WaterfallBar({item, color, requestStartUs, requestTotalUs}: WaterfallBarProps) {
  const {space} = useTheme();
  const [textWidth, setTextWidth] = useState<number>(0);

  const offset = ((item.startUs - requestStartUs) / requestTotalUs) * 100;
  const width = (item.durationUs / requestTotalUs) * 100;

  const textLeft = `min(
    calc(${width + offset}% + ${space.xs}),
    calc(100% - ${textWidth}px - ${space.xs})
  )`;

  return (
    <Flex align="center" position="relative" height="16px">
      <div
        style={{
          position: 'absolute',
          background: color,
          left: `${offset}%`,
          width: `${width}%`,
          height: '100%',
        }}
      />
      <Text
        size="xs"
        variant="muted"
        style={{position: 'absolute', left: textLeft}}
        ref={el => setTextWidth(el?.getBoundingClientRect().width ?? 0)}
      >{`${item.durationUs}μs`}</Text>
    </Flex>
  );
}
