import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import type {StepProps} from './types';

export function ScmProjectDetails({onComplete}: StepProps) {
  return (
    <Flex direction="column" align="center" justify="center" gap="lg" flexGrow={1}>
      <Heading as="h2">{t('Project details')}</Heading>
      <Button priority="primary" onClick={() => onComplete()}>
        {t('Continue')}
      </Button>
    </Flex>
  );
}
