import type {Ref} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {
  getFileName,
  getImageAddress,
} from 'sentry/components/events/interfaces/debugMeta/utils';
import {NotAvailable} from 'sentry/components/notAvailable';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';

import {Processings} from './processings';
import {Status} from './status';

type Props = {
  'data-index': number;
  image: ImageWithCombinedStatus;
  onOpenImageDetailsModal: (image: ImageWithCombinedStatus) => void;
  ref: Ref<HTMLTableRowElement>;
};

export function DebugImage({image, onOpenImageDetailsModal, ...rowProps}: Props) {
  const {unwind_status, debug_status, debug_file, code_file, status} = image;
  const codeFilename = getFileName(code_file);
  const debugFilename = getFileName(debug_file);
  const imageAddress = getImageAddress(image);

  return (
    <SimpleTable.Row {...rowProps}>
      <SimpleTable.RowCell>
        <Status status={status} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
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
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        {unwind_status || debug_status ? (
          <Processings unwind_status={unwind_status} debug_status={debug_status} />
        ) : (
          <NotAvailable />
        )}
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Button size="xs" onClick={() => onOpenImageDetailsModal(image)}>
          {t('View')}
        </Button>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
