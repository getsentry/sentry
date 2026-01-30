import {Button} from 'sentry/components/core/button';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {
  getFileName,
  getImageAddress,
} from 'sentry/components/events/interfaces/debugMeta/utils';
import NotAvailable from 'sentry/components/notAvailable';
import {t} from 'sentry/locale';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';

import Processings from './processings';
import Status from './status';

type Props = {
  image: ImageWithCombinedStatus;
  isLast: boolean;
  onOpenImageDetailsModal: (image: ImageWithCombinedStatus) => void;
};

function DebugImage({image, isLast, onOpenImageDetailsModal}: Props) {
  const {unwind_status, debug_status, debug_file, code_file, status} = image;
  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <Grid
      columns={{
        '2xs': '0.6fr 1.5fr 0.6fr',
        xs: '0.6fr 2fr 0.6fr',
        sm: '0.6fr 2fr 1fr 0.4fr',
      }}
      borderBottom={isLast ? undefined : 'primary'}
      padding="sm md"
    >
      <Flex align="center" minWidth="0" padding="sm md">
        <Status status={status} />
      </Flex>
      <Flex align="center" minWidth="0" padding="sm 0">
        <Flex direction="column" minWidth="0" overflow="hidden">
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
        </Flex>
      </Flex>
      <Flex
        align="center"
        minWidth="0"
        display={{'2xs': 'none', xs: 'none', sm: 'flex'}}
        padding="sm md"
      >
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </Flex>
      <Flex align="center" justify="end" minWidth="0" padding="sm md">
        <Button size="xs" onClick={() => onOpenImageDetailsModal(image)}>
          {t('View')}
        </Button>
      </Flex>
    </Grid>
  );
}

export default DebugImage;
