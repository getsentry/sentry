import {Alert} from '@sentry/scraps/alert';

import {Flex} from 'sentry/components/core/layout';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  message?: string;
}

export default function ArchivedReplayAlert({message}: Props) {
  return (
    <Alert type="warning" data-test-id="replay-archived" showIcon={false}>
      <Flex gap="xs" align="center">
        <IconDelete color="gray500" size="sm" />
        {message ?? t('This replay has been deleted.')}
      </Flex>
    </Alert>
  );
}
