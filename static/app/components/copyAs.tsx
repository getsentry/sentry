import {useCallback} from 'react';

import {Button, ButtonBar, type ButtonProps} from '@sentry/scraps/button';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu, type DropdownMenuProps} from 'sentry/components/dropdownMenu';
import {IconChevron, IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

interface CopyAsButtonProps extends Omit<ButtonProps, 'children' | 'onCopy' | 'onClick'> {
  items: DropdownMenuProps['items'];
  json?: () => string;
  markdown?: () => string;
  text?: () => string;
}

export function CopyAsButton({items, ...props}: CopyAsButtonProps) {
  const [preference, setPreference] = useLocalStorageState<'markdown' | 'text' | 'json'>(
    'copy-as-preference',
    'markdown'
  );

  const {markdown, text, json} = props;
  const handleCopy = useCallback(
    (format: 'markdown' | 'text' | 'json') => {
      setPreference(format);

      if (format === 'markdown') {
        markdown?.();
        addSuccessMessage(t('Copied to clipboard as Markdown'));
      } else if (format === 'text') {
        text?.();
        addSuccessMessage(t('Copied to clipboard as Text'));
      } else if (format === 'json') {
        json?.();
        addSuccessMessage(t('Copied to clipboard as JSON'));
      }
    },
    [markdown, text, json, setPreference]
  );

  return (
    <ButtonBar merged gap="0">
      <Button {...props} onClick={() => handleCopy(preference)} icon={<IconCopy />}>
        {t('Copy as') +
          (preference === 'markdown'
            ? ' ' + t('Markdown')
            : preference === 'text'
              ? ' ' + t('Text')
              : '')}
      </Button>
      <DropdownMenu
        size={props.size === 'zero' ? 'xs' : props.size}
        trigger={(triggerProps, isOpen) => (
          <Button
            {...triggerProps}
            aria-label={t('Copy as options')}
            icon={
              <IconChevron variant="muted" direction={isOpen ? 'up' : 'down'} size="xs" />
            }
            {...props}
          />
        )}
        items={[
          {
            key: 'markdown',
            label: t('Markdown'),
            onAction: () => handleCopy('markdown'),
            disabled: !props.markdown,
          },
          {
            key: 'text',
            label: t('Text'),
            onAction: () => handleCopy('text'),
            disabled: !props.text,
          },
          {
            key: 'json',
            label: t('JSON'),
            onAction: () => handleCopy('json'),
            disabled: !props.json,
          },
        ]}
        isDisabled={props.disabled}
      />
    </ButtonBar>
  );
}
