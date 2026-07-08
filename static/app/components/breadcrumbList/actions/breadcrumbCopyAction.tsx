import {RevealOnHover} from '@sentry/scraps/revealOnHover';
import {Tooltip} from '@sentry/scraps/tooltip';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';

export interface BreadcrumbCopyActionProps {
  /** Accessible name for the copy button. */
  label: string;
  /** The value copied to the clipboard when the button is pressed. */
  text: string;
  /**
   * When true the button is always visible. Otherwise it only appears when the
   * surrounding crumb is hovered or focused (the default trailing-action idiom).
   */
  alwaysVisible?: boolean;
  /** Fires with the copied text after a successful copy — use for analytics. */
  onCopy?: (copiedText: string) => void;
  /** Optional tooltip shown on hover. */
  tooltip?: React.ReactNode;
}

/**
 * A copy-to-clipboard trailing action for the page-title crumb. Wraps
 * `CopyToClipboardButton` in `RevealOnHover.Action` so it reveals with the crumb
 * on hover unless `alwaysVisible` is set. The clipboard/analytics wiring lives in
 * the consumer (via `text`/`onCopy`), not here.
 */
export function BreadcrumbCopyAction({
  text,
  label,
  alwaysVisible,
  tooltip,
  onCopy,
}: BreadcrumbCopyActionProps) {
  return (
    <RevealOnHover.Action visible={alwaysVisible}>
      <Tooltip title={tooltip} disabled={!tooltip}>
        <CopyToClipboardButton
          size="zero"
          variant="transparent"
          aria-label={label}
          text={text}
          onCopy={onCopy}
        />
      </Tooltip>
    </RevealOnHover.Action>
  );
}
