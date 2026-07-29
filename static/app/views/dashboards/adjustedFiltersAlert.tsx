import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getPageFilterAdjustmentMessage} from 'sentry/components/pageFilters/adjustments';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';

interface AdjustedFiltersAlertProps {
  /**
   * Whether the dashboard shows a save button for the adjusted selection. When
   * it does, the alert tells the user they need to save to keep the change.
   */
  hasUnsavedChanges: boolean;
}

/**
 * Explains adjustments page filters made to the user's selection on load.
 *
 * Dashboards compares the current selection against the saved one, so an
 * adjustment shows up as a dirty state with a "Save" button the user didn't
 * ask for. Rather than hide that (the selection really did change), we say
 * what happened and why.
 */
export function AdjustedFiltersAlert({hasUnsavedChanges}: AdjustedFiltersAlertProps) {
  const {adjustments} = usePageFilters();

  if (adjustments.length === 0) {
    return null;
  }

  return (
    <Alert variant="info" showIcon>
      <Stack gap="xs">
        {adjustments.map(adjustment => (
          <Text key={`${adjustment.filter}-${adjustment.reason}`}>
            {getPageFilterAdjustmentMessage(adjustment)}
          </Text>
        ))}
        {hasUnsavedChanges ? (
          <Text>{t('Save this dashboard to keep the new selection.')}</Text>
        ) : null}
      </Stack>
    </Alert>
  );
}
