import styled from '@emotion/styled';
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
    <Menu.Section {...itemProps}>
      {node.rendered && (
        <Container padding="md lg">
          <Menu.SectionTitle {...headingProps}>{node.rendered}</Menu.SectionTitle>
        </Container>
      )}
      <Group {...groupProps}>{children}</Group>
    </Menu.Section>
  );
}

const Group = styled('ul')`
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
