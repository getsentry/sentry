import {Tooltip} from '@sentry/scraps/tooltip';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import type {ImageStatus} from 'sentry/types/debugImage';

import ProcessingIcon, {getProcessingTooltip} from './processingIcon';

type Props = {
  debug_status?: ImageStatus | null;
  unwind_status?: ImageStatus | null;
};

function StatusItem({status, label}: {label: string; status: ImageStatus}) {
  const tooltip = getProcessingTooltip(status);
  return (
    <Tooltip title={tooltip} skipWrapper>
      <Flex align="center" gap="sm">
        <ProcessingIcon status={status} />
        <Text size="sm">{label}</Text>
      </Flex>
    </Tooltip>
  );
}

function Processings({unwind_status, debug_status}: Props) {
  if (!debug_status && !unwind_status) {
    return null;
  }

  return (
    <Flex wrap="wrap" align="center" gap="md">
      {debug_status && <StatusItem status={debug_status} label={t('Symbolication')} />}
      {unwind_status && (
        <StatusItem status={unwind_status} label={t('Stack Unwinding')} />
      )}
    </Flex>
  );
}

export default Processings;
