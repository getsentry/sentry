import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  message?: string;
}

export default function ArchivedReplayAlert({message}: Props) {
  return (
    <Alert variant="warning" data-test-id="replay-archived" showIcon={false}>
      <Flex gap="xs" align="center">
        <IconDelete variant="muted" size="sm" />
        {message ?? t('This replay has been deleted.')}
      </Flex>
    </Alert>
  );
}
