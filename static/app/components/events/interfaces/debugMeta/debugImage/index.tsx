import {Button} from '@sentry/scraps/button';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  getFileName,
  getImageAddress,
} from 'sentry/components/events/interfaces/debugMeta/utils';
import {NotAvailable} from 'sentry/components/notAvailable';
import {t} from 'sentry/locale';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';

import {Processings} from './processings';
import {Status} from './status';

export const DEBUG_IMAGE_GRID_COLUMNS = {
  zero: '0.6fr 1.5fr 0.6fr',
  sm: '0.6fr 2fr 0.6fr',
  md: '0.6fr 2fr 1fr 0.4fr',
} as const;

type Props = {
  image: ImageWithCombinedStatus;
  isLast: boolean;
  onOpenImageDetailsModal: (image: ImageWithCombinedStatus) => void;
};

export function DebugImage({image, isLast, onOpenImageDetailsModal}: Props) {
  const {unwind_status, debug_status, debug_file, code_file, status} = image;
  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <Grid
      align="center"
      columns={DEBUG_IMAGE_GRID_COLUMNS}
      borderBottom={isLast ? undefined : 'primary'}
      padding="md lg"
    >
      <Flex align="center" minWidth="0">
        <Status status={status} />
      </Flex>
      <Stack minWidth="0" overflow="hidden">
        <Text ellipsis>
          {codeFilename && <Tooltip title={code_file}>{codeFilename}</Tooltip>}
          {codeFilename !== debugFilename && debugFilename && (
            <Text variant="muted"> ({debugFilename})</Text>
          )}
        </Text>
        {imageAddress && (
          <Text monospace size="sm" variant="muted">
            {imageAddress}
          </Text>
        )}
      </Stack>
      <Flex align="center" minWidth="0" display={{zero: 'none', md: 'flex'}}>
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </Flex>
      <Flex align="center" justify="end" minWidth="0">
        <Button size="xs" onClick={() => onOpenImageDetailsModal(image)}>
          {t('View')}
        </Button>
      </Flex>
    </Grid>
  );
}
