import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

interface ExplorerAutofixStartProps {
  onStartRootCause: () => void;
  isLoading?: boolean;
}

/**
 * Start screen for Explorer-based Autofix.
 *
 * Shows a simple interface with a button to start root cause analysis.
 * Other steps become available after root cause completes.
 */
export function ExplorerAutofixStart({
  onStartRootCause,
  isLoading,
}: ExplorerAutofixStartProps) {
  return (
    <Container padding="3xl">
      <Flex direction="column" gap="2xl" align="start">
        <Text size="md" variant="muted" align="left">
          {t(
            'Seer will first find the root cause of this issue, then you can continue to get a solution, assess the impact, or triage the issue to your team.'
          )}
        </Text>
        <Flex>
          <Button
            priority="primary"
            onClick={onStartRootCause}
            disabled={isLoading}
            size="md"
          >
            {isLoading ? t('Starting...') : t('Find Root Cause')}
          </Button>
        </Flex>
      </Flex>
    </Container>
  );
}
