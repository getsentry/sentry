import {IconStack} from '@sentry/icons/stack';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {
  getSeerSelectionLabel,
  useSeerSelection,
} from 'sentry/views/seerExplorer/contexts/seerSelection';

/**
 * Shows the table selection Seer receives with the page context, and turns it
 * on or off. Renders nothing while no rows are selected.
 */
export function SeerSelectionToggle() {
  const {selection, isIncluded, setIncluded} = useSeerSelection();

  if (!selection) {
    return null;
  }

  const label = getSeerSelectionLabel(selection);

  return (
    <Button
      size="zero"
      variant="transparent"
      aria-pressed={isIncluded}
      aria-label={t('Include %s in context', label)}
      tooltipProps={{
        title: isIncluded
          ? t('Seer sees your selection. Click to leave it out.')
          : t('Click to let Seer see your selection.'),
      }}
      onClick={() => setIncluded(!isIncluded)}
    >
      <Tag
        variant={isIncluded ? 'info' : 'muted'}
        icon={isIncluded ? <IconStack /> : undefined}
      >
        {label}
      </Tag>
    </Button>
  );
}
