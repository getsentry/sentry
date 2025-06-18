import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  message?: string;
}

export default function ArchivedReplayAlert({message}: Props) {
  return (
    <Alert type="warning" data-test-id="replay-archived">
      <Flex gap={space(0.5)}>
        <IconDelete color="gray500" size="sm" />
        {message ?? t('This replay has been deleted.')}
      </Flex>
    </Alert>
  );
}
