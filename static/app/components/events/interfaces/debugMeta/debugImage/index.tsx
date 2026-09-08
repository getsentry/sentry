import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
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

type Props = {
  image: ImageWithCombinedStatus;
  onOpenImageDetailsModal: (image: ImageWithCombinedStatus) => void;
};

export function DebugImage({image, onOpenImageDetailsModal}: Props) {
  const {unwind_status, debug_status, debug_file, code_file, status} = image;
  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <Fragment>
      <Flex as="td" role="cell" align="center" minWidth="0" padding="sm md">
        <Status status={status} />
      </Flex>
      <Flex as="td" role="cell" align="center" minWidth="0" padding="sm 0">
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
      </Flex>
      <Flex as="td" role="cell" align="center" minWidth="0" padding="sm md">
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </Flex>
      <Flex as="td" role="cell" align="center" justify="end" minWidth="0" padding="sm md">
        <Button size="xs" onClick={() => onOpenImageDetailsModal(image)}>
          {t('View')}
        </Button>
      </Flex>
    </Fragment>
  );
}
import {Fragment} from 'react';
