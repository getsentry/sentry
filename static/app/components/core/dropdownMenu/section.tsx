import {useMenuSection} from '@react-aria/menu';
import type {Node} from '@react-types/shared';

import {Container} from '@sentry/scraps/layout';
import {Menu} from '@sentry/scraps/menu';

import type {MenuItemProps} from './item';

type DropdownMenuSectionProps = {
  children: React.ReactNode;
  node: Node<MenuItemProps>;
};

/**
 * A wrapper component for menu sections. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
export function DropdownMenuSection({node, children}: DropdownMenuSectionProps) {
  const {itemProps, headingProps, groupProps} = useMenuSection({
    heading: node.rendered,
    'aria-label': node['aria-label'],
  });

  return (
    <Menu.ItemGroup {...itemProps}>
      {node.rendered && (
        <Container padding="md xl">
          <Menu.ItemGroupLabel {...headingProps}>{node.rendered}</Menu.ItemGroupLabel>
        </Container>
      )}
      <Menu.ItemGroupList {...groupProps}>{children}</Menu.ItemGroupList>
    </Menu.ItemGroup>
  );
}
