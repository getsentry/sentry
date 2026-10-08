import {Fragment, useState, type ComponentProps} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {DropdownMenu, type MenuItemProps} from '@sentry/scraps/dropdownMenu';

import type {GroupListColumn} from 'sentry/components/issues/groupList';
import {IssueStreamHeaderLabel} from 'sentry/components/IssueStreamHeaderLabel';
import {IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  ISSUE_DISPLAY_PROPERTIES,
  useIssueDisplayProperties,
} from 'sentry/views/issueList/displayProperties';

type Props = ComponentProps<typeof IssueStreamHeaderLabel> & {
  column?: GroupListColumn;
};

export function HeaderContextMenu({column, ...props}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const {columns, toggleColumn} = useIssueDisplayProperties();
  const items: MenuItemProps[] = [
    ...(column
      ? [{key: 'hide', label: t('Hide column'), onAction: () => toggleColumn(column)}]
      : []),
    {
      key: 'columns',
      label: t('Columns'),
      submenu: true,
      children: ISSUE_DISPLAY_PROPERTIES.map(({value, label}) => ({
        key: value,
        label: (
          <Fragment>
            {label}
            <VisuallyHidden>
              {columns.includes(value) ? t('Visible') : t('Hidden')}
            </VisuallyHidden>
          </Fragment>
        ),
        textValue: label,
        trailingItems: columns.includes(value) ? (
          <IconCheckmark size="xs" aria-hidden="true" />
        ) : null,
        onAction: () => toggleColumn(value),
      })),
    },
  ];

  return (
    <DropdownMenu
      items={items}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      strategy="fixed"
      minMenuWidth={180}
      trigger={triggerProps => (
        <IssueStreamHeaderLabel
          {...props}
          {...triggerProps}
          tabIndex={0}
          onClick={undefined}
          onPointerDown={undefined}
          onKeyUp={undefined}
          onContextMenu={event => {
            event.preventDefault();
            event.currentTarget.focus();
            setIsOpen(true);
          }}
          onKeyDown={event => {
            if (event.target !== event.currentTarget) {
              return;
            }
            if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
        />
      )}
    />
  );
}
