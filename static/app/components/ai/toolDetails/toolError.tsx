import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {ToolError as ToolErrorData} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';

export function ToolError({error}: {error: ToolErrorData}) {
  return (
    <Alert variant="danger">
      <Stack gap="sm" minWidth="0">
        <Flex align="center" gap="sm" wrap="wrap">
          <Text bold>{t('Tool call failed')}</Text>
          {error.type ? <Tag variant="danger">{error.type}</Tag> : null}
        </Flex>
        {error.message ? (
          <Text as="div" wrap="pre-wrap" wordBreak="break-word">
            {error.message}
          </Text>
        ) : (
          <Text variant="muted">
            {t('No error message was recorded for this tool call')}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}
