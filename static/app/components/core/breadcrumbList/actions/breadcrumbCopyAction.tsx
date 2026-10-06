import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';

export interface BreadcrumbCopyActionProps {
  /** Accessible name for the copy button. */
  label: string;
  /** The value copied to the clipboard when the button is pressed. */
  text: string;
  /** Optional icon override. Defaults to the generic copy icon. */
  icon?: React.ReactNode;
  /** Fires with the copied text after a successful copy — use for analytics. */
  onCopy?: (copiedText: string) => void;
  /** Optional tooltip shown on hover. */
  tooltip?: React.ReactNode;
}

/**
 * A copy-to-clipboard trailing action for the page-title crumb. Always visible —
 * a persistent affordance is more discoverable and keyboard-accessible than a
 * hover-revealed one. The clipboard/analytics wiring lives in the consumer (via
 * `text`/`onCopy`), not here.
 */
export function BreadcrumbCopyAction({
  text,
  label,
  tooltip,
  onCopy,
  icon,
}: BreadcrumbCopyActionProps) {
  return (
    <CopyToClipboardButton
      size="zero"
      variant="transparent"
      aria-label={label}
      text={text}
      icon={icon}
      onCopy={onCopy}
      tooltipProps={{title: tooltip}}
    />
  );
}
