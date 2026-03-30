import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

function DummyStepOne({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{message: string}, {name: string}>) {
  const [name, setName] = useState('');

  return (
    <Stack gap="md">
      <Text>{stepData.message ?? t('Enter your name to continue')}</Text>
      <InputGroup>
        <InputGroup.Input
          aria-label={t('Your name')}
          value={name}
          onChange={e => setName(e.target.value)}
        />
      </InputGroup>
      <Button
        size="sm"
        priority="primary"
        onClick={() => advance({name})}
        disabled={isAdvancing || !name}
      >
        {t('Continue')}
      </Button>
    </Stack>
  );
}

function DummyStepTwo({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{greeting: string}>) {
  return (
    <Stack gap="md">
      <Text>{stepData.greeting ?? t('Dummy step two')}</Text>
      <Button
        size="sm"
        priority="primary"
        onClick={() => advance()}
        disabled={isAdvancing}
      >
        {t('Finish')}
      </Button>
    </Stack>
  );
}

type DummyCompletionData = {
  result: string;
};

export const dummyIntegrationPipeline = {
  type: 'integration',
  provider: 'dummy',
  actionTitle: t('Dummy Integration Pipeline'),
  getCompletionData: pipelineComplete<DummyCompletionData>,
  steps: [
    {
      stepId: 'step_one',
      shortDescription: t('Enter Name'),
      component: DummyStepOne,
    },
    {
      stepId: 'step_two',
      shortDescription: t('Confirmation'),
      component: DummyStepTwo,
    },
  ],
} as const satisfies PipelineDefinition;
