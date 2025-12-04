import {Fragment} from 'react';
import documentation from '!!type-loader!sentry/components/dropdownMenu';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import {IconCopy, IconDelete, IconDownload, IconEdit} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

export default Storybook.story('DropdownMenu', (story, APIReference) => {
  APIReference(documentation.props?.DropdownMenu);

  story('Default', () => {
    const items: MenuItemProps[] = [
      {
        key: 'edit',
        label: 'Edit',
        leadingItems: <IconEdit size="sm" />,
        onAction: () => {},
      },
      {
        key: 'copy',
        label: 'Copy',
        leadingItems: <IconCopy size="sm" />,
        onAction: () => {},
      },
      {
        key: 'download',
        label: 'Download',
        leadingItems: <IconDownload size="sm" />,
        onAction: () => {},
      },
      {
        key: 'delete',
        label: 'Delete',
        leadingItems: <IconDelete size="sm" />,
        onAction: () => {},
        disabled: true,
      },
    ];

    return (
      <Fragment>
        <p>
          <Storybook.JSXNode name="DropdownMenu" /> is a versatile menu component that
          renders both a trigger button and the dropdown menu. It supports icons, disabled
          states, links, and submenus.
        </p>
        <Storybook.SideBySide>
          <DropdownMenu triggerLabel="Actions" items={items} />
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('With Sections', () => {
    const items: MenuItemProps[] = [
      {
        key: 'section1',
        label: 'Edit Actions',
        children: [
          {
            key: 'edit',
            label: 'Edit Item',
            leadingItems: <IconEdit size="sm" />,
            onAction: () => {},
          },
          {
            key: 'copy',
            label: 'Duplicate',
            leadingItems: <IconCopy size="sm" />,
            onAction: () => {},
          },
        ],
      },
      {
        key: 'section2',
        label: 'Export Actions',
        children: [
          {
            key: 'download',
            label: 'Download',
            leadingItems: <IconDownload size="sm" />,
            onAction: () => {},
          },
        ],
      },
      {
        key: 'section3',
        label: 'Danger Zone',
        children: [
          {
            key: 'delete',
            label: 'Delete Item',
            leadingItems: <IconDelete size="sm" />,
            onAction: () => {},
          },
        ],
      },
    ];

    return (
      <Fragment>
        <p>
          Menu items can be organized into sections by providing{' '}
          <Storybook.JSXProperty name="children" value={items} /> for an item. Each
          section will be rendered with a title and separated by dividers.
        </p>
        <Storybook.SideBySide>
          <DropdownMenu triggerLabel="Organized Menu" items={items} />
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('With Links', () => {
    const items: MenuItemProps[] = [
      {
        key: 'internal',
        label: 'Dashboard',
        to: '/dashboard/',
        leadingItems: <IconEdit size="sm" />,
      },
      {
        key: 'external',
        label: 'Documentation',
        externalHref: 'https://docs.sentry.io',
        leadingItems: <IconDownload size="sm" />,
      },
      {
        key: 'action',
        label: 'Action Item',
        leadingItems: <IconCopy size="sm" />,
        onAction: () => {}, // 'Action clicked'
      },
    ];

    return (
      <Fragment>
        <p>
          Menu items can be links by providing either{' '}
          <Storybook.JSXProperty name="to" value="/dashboard/" /> for internal routing or{' '}
          <Storybook.JSXProperty name="externalHref" value="https://docs.sentry.io" /> for
          external links.
        </p>
        <Storybook.SideBySide>
          <DropdownMenu triggerLabel="Links & Actions" items={items} />
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('With Submenus', () => {
    const items: MenuItemProps[] = [
      {
        key: 'edit',
        label: 'Edit',
        leadingItems: <IconEdit size="sm" />,
        onAction: () => {}, // 'Edit clicked'
      },
      {
        key: 'export',
        label: 'Export',
        leadingItems: <IconDownload size="sm" />,
        isSubmenu: true,
        submenuTitle: 'Export Options',
        children: [
          {
            key: 'export-json',
            label: 'Export as JSON',
            onAction: () => {}, // 'Export JSON clicked'
          },
          {
            key: 'export-csv',
            label: 'Export as CSV',
            onAction: () => {}, // 'Export CSV clicked'
          },
          {
            key: 'export-pdf',
            label: 'Export as PDF',
            onAction: () => {}, // 'Export PDF clicked'
          },
        ],
      },
      {
        key: 'delete',
        label: 'Delete',
        leadingItems: <IconDelete size="sm" />,
        onAction: () => {}, // 'Delete clicked'
      },
    ];

    return (
      <Fragment>
        <p>
          Menu items can trigger submenus by setting{' '}
          <Storybook.JSXProperty name="isSubmenu" value="true" /> and providing{' '}
          <Storybook.JSXProperty name="children" value={[]} />. Submenus are opened on
          hover or arrow key navigation.
        </p>
        <Storybook.SideBySide>
          <DropdownMenu triggerLabel="With Submenu" items={items} />
        </Storybook.SideBySide>
      </Fragment>
    );
  });

  story('Different Sizes', () => {
    const items: MenuItemProps[] = [
      {
        key: 'action1',
        label: 'Action One',
        leadingItems: <IconEdit size="sm" />,
        onAction: () => {}, // 'Action 1 clicked'
      },
      {
        key: 'action2',
        label: 'Action Two',
        leadingItems: <IconCopy size="sm" />,
        onAction: () => {}, // 'Action 2 clicked'
      },
    ];

    return (
      <Fragment>
        <p>
          The <Storybook.JSXProperty name="size" value="sm" /> prop affects both the
          trigger button and menu items.
        </p>
        <Flex direction="row" gap="md" align="start">
          <DropdownMenu triggerLabel="Small" items={items} size="sm" />
          <DropdownMenu triggerLabel="Medium" items={items} size="md" />
        </Flex>
      </Fragment>
    );
  });

  story('Custom Trigger', () => {
    const items: MenuItemProps[] = [
      {
        key: 'profile',
        label: 'Profile',
        onAction: () => {}, // 'Profile clicked'
      },
      {
        key: 'settings',
        label: 'Settings',
        onAction: () => {}, // 'Settings clicked'
      },
      {
        key: 'logout',
        label: 'Log out',
        onAction: () => {}, // 'Logout clicked'
      },
    ];

    return (
      <Fragment>
        <p>
          You can customize the trigger by providing a{' '}
          <Storybook.JSXProperty name="trigger" value={Function} /> render prop. The
          trigger function receives the button props and open state.
        </p>
        <Storybook.SideBySide>
          <DropdownMenu
            items={items}
            trigger={(props, isOpen) => (
              <Button {...props} priority="primary">
                {isOpen ? '▲ Menu' : '▼ Menu'}
              </Button>
            )}
          />
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});
