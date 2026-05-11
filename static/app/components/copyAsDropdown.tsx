import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';

interface CopyAsDropdownProps extends Omit<DropdownMenuProps, 'trigger'> {
  items: DropdownMenuProps['items'];
}

export function CopyAsDropdown(props: CopyAsDropdownProps) {
  return (
    <DropdownMenu
      size={props.size}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} icon={<IconCopy />} size="xs">
          {t('Copy as')}
        </OverlayTrigger.Button>
      )}
      {...props}
      items={props.items.filter(item => !item.disabled)}
    />
  );
}

CopyAsDropdown.makeDefaultCopyAsOptions = (props: {
  json: (() => string) | undefined;
  markdown: (() => string) | undefined;
  text: (() => string) | undefined;
}): DropdownMenuProps['items'] => {
  return [
    {
      key: 'markdown',
      label: t('Markdown'),
      disabled: props.markdown === undefined,
      onAction: () => {
        if (!props.markdown) {
          return;
        }
        copyToClipboard(props.markdown())
          .then(() => addSuccessMessage(t('Copied to clipboard')))
          .catch(() => addErrorMessage(t('Failed to clipboard')));
      },
    },
    {
      key: 'text',
      label: t('Text'),
      disabled: props.text === undefined,
      onAction: () => {
        if (!props.text) {
          return;
        }
        copyToClipboard(props.text())
          .then(() => addSuccessMessage(t('Copied to clipboard')))
          .catch(() => addErrorMessage(t('Failed to clipboard')));
      },
    },
    {
      key: 'json',
      label: t('JSON'),
      disabled: props.json === undefined,
      onAction: () => {
        if (!props.json) {
          return;
        }
        copyToClipboard(props.json?.())
          .then(() => addSuccessMessage(t('Copied to clipboard')))
          .catch(() => addErrorMessage(t('Failed to clipboard')));
      },
    },
  ];
};
