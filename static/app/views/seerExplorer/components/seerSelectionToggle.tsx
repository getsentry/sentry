import {IconStack} from '@sentry/icons/stack';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import {
  getSeerSelectionLabel,
  useSeerSelection,
} from 'sentry/views/seerExplorer/contexts/seerSelection';
import {hasStructuredPageContext} from 'sentry/views/seerExplorer/hooks/usePageContextCapture';
import {usePageRouteString} from 'sentry/views/seerExplorer/utils';

/**
 * Shows the table selection Seer receives with the page context, and turns it
 * on or off. Renders nothing while no rows are selected, or on pages whose page
 * context can't carry the selection.
 */
export function SeerSelectionToggle() {
  const {selection, isIncluded, setIncluded} = useSeerSelection();
  const route = usePageRouteString();

  if (!selection || !hasStructuredPageContext(route)) {
    return null;
  }

  return (
    <SeerSelectionTagButton
      label={getSeerSelectionLabel(selection)}
      isIncluded={isIncluded}
      onToggle={() => setIncluded(!isIncluded)}
    />
  );
}

interface SeerSelectionTagButtonProps {
  isIncluded: boolean;
  label: string;
  onToggle: () => void;
}

export function SeerSelectionTagButton({
  isIncluded,
  label,
  onToggle,
}: SeerSelectionTagButtonProps) {
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
      onClick={onToggle}
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
