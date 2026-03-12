import styled from '@emotion/styled';
import {useMenuSection} from '@react-aria/menu';
import type {Node} from '@react-types/shared';

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
    <DropdownMenuSectionWrap {...itemProps}>
      {node.rendered && <Heading {...headingProps}>{node.rendered}</Heading>}
      <Group {...groupProps}>{children}</Group>
    </DropdownMenuSectionWrap>
  );
}

const DropdownMenuSectionWrap = styled('li')`
  list-style-type: none;
`;

const Heading = styled('span')`
  display: inline-block;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${p => p.theme.space.md} ${p => p.theme.space.lg} ${p => p.theme.space.xs};
  padding-right: ${p => p.theme.space.md};

  ${DropdownMenuSectionWrap}:first-of-type & {
    margin-top: ${p => p.theme.space.xs};
  }
`;

const Group = styled('ul')`
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
