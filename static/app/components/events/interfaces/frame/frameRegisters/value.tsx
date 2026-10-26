import {Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {t} from 'sentry/locale';
import type {Meta} from 'sentry/types/group';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';

type Props = {
  isHexadecimal: boolean;
  meta: Meta | undefined;
  value: string | number;
};

function formatRegisterValue(value: string | number, isHexadecimal: boolean) {
  const parsed = typeof value === 'string' ? parseInt(value, 16) : value;

  if (isNaN(parsed)) {
    return value;
  }

  return isHexadecimal ? `0x${parsed.toString(16).padStart(16, '0')}` : `${parsed}`;
}

export function FrameRegisterValue({isHexadecimal, meta, value}: Props) {
  const formattedValue = formatRegisterValue(value, isHexadecimal);

  return (
    <Grid
      columns="minmax(0, 1fr) 1.5rem"
      align="center"
      gap="xs"
      width="100%"
      minWidth="0"
      padding="sm md sm lg"
      radius="sm"
      background="secondary"
    >
      <Text
        align="left"
        density="compressed"
        monospace
        size="sm"
        tabular
        wordBreak="break-word"
      >
        <AnnotatedText value={formattedValue} meta={meta} />
      </Text>
      {isEmptyObject(meta) ? (
        <CopyToClipboardButton
          text={String(formattedValue)}
          size="zero"
          variant="transparent"
          aria-label={t('Copy register value to clipboard')}
          tooltipProps={{title: t('Copy register value')}}
        />
      ) : null}
    </Grid>
  );
}
