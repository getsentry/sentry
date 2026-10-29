import {IconAdd} from '@sentry/icons/add';

import {Button} from '@sentry/scraps/button';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface PathMappingEmptyStateProps {
  onAdd: () => void;
}

export function PathMappingEmptyState({onAdd}: PathMappingEmptyStateProps) {
  return (
    <Container border="muted" radius="md" padding="2xl" style={{borderStyle: 'dashed'}}>
      <Stack gap="xl" align="center">
        <Stack gap="xs" align="center">
          <Text bold>{t('No paths configured')}</Text>
          <Text size="sm" variant="muted" align="center">
            {t(
              'Add a path mapping to enable stack trace links, suspect commits, and code owners for this repository.'
            )}
          </Text>
        </Stack>
        <Button size="sm" icon={<IconAdd />} onClick={onAdd}>
          {t('Add path')}
        </Button>
      </Stack>
    </Container>
  );
}
