import {IconThumb} from '@sentry/icons/thumb';

import {Button} from '@sentry/scraps/button';
import {useResponsivePropValue} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';

interface SnapshotApproveButtonProps {
  disabled: boolean;
  onApprove: () => void;
}

/**
 * Its own component rather than inline JSX, because the breadcrumb slot renders
 * through a portal that bridges the container context from the TopBar. Resolving
 * the breakpoint here reads that container; resolving it in the consumer's body
 * would read the page, where there is none.
 */
export function SnapshotApproveButton({disabled, onApprove}: SnapshotApproveButtonProps) {
  const showLabel = useResponsivePropValue<boolean>({zero: false, md: true});

  return (
    <Button
      size="zero"
      variant="primary"
      icon={<IconThumb />}
      onClick={onApprove}
      disabled={disabled}
      // Always named, so the icon-only form at narrow widths keeps its name.
      aria-label={t('Approve')}
    >
      {showLabel ? t('Approve') : null}
    </Button>
  );
}
