import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {PageFilterAdjustments} from 'sentry/components/pageFilters/adjustments';
import {getPageFilterAdjustmentMessage} from 'sentry/components/pageFilters/adjustments';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';

const FILTER_ORDER: Array<keyof PageFilterAdjustments> = [
  'projects',
  'environments',
  'datetime',
];

interface AdjustedFiltersAlertProps {
  hasUnsavedChanges: boolean;
}

/**
 * Explains adjustments page filters made to the selection on load.
 *
 * An adjustment shows up as a dirty state with a "Save" button the user didn't
 * ask for. Rather than hide that (the selection really did change), say what
 * happened and why.
 */
export function AdjustedFiltersAlert({hasUnsavedChanges}: AdjustedFiltersAlertProps) {
  const {adjustments} = usePageFilters();

  const sentences = FILTER_ORDER.map(filter => adjustments[filter])
    .filter(defined)
    .map(getPageFilterAdjustmentMessage);

  if (sentences.length === 0) {
    return null;
  }

  if (hasUnsavedChanges) {
    sentences.push(t('Save this dashboard to keep the new selection.'));
  }

  return (
    <Alert variant="info" showIcon>
      <Stack gap="xs">
        {sentences.map(sentence => (
          <Text key={sentence}>{sentence}</Text>
        ))}
      </Stack>
    </Alert>
  );
}
