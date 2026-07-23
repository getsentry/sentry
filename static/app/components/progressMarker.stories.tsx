import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ProgressMarker, type ProgressMarkerStep} from 'sentry/components/progressMarker';
import * as Storybook from 'sentry/stories';

const PROGRESS_MARKER_STEPS = [
  'empty',
  'quarter',
  'half',
  'three-quarters',
  'complete',
] satisfies ProgressMarkerStep[];

const STEP_LABELS: Record<ProgressMarkerStep, string> = {
  complete: 'Complete',
  empty: 'Start',
  half: 'Half',
  quarter: 'Quarter',
  'three-quarters': 'Three quarters',
};

export default Storybook.story('ProgressMarker', story => {
  story('Steps', () => (
    <Stack gap="lg">
      {PROGRESS_MARKER_STEPS.map(step => (
        <Flex key={step} align="center" gap="sm">
          <ProgressMarker step={step} aria-label={STEP_LABELS[step]} />
          <Stack gap="xs">
            <Text>{STEP_LABELS[step]}</Text>
            <Text size="sm" variant="muted">
              {step}
            </Text>
          </Stack>
        </Flex>
      ))}
    </Stack>
  ));
});
