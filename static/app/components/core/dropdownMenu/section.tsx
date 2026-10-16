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
  display: block;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  font-size: ${p => p.theme.font.size.sm};
  line-height: ${p => p.theme.font.lineHeight.fixed};
  color: ${p => p.theme.tokens.interactive.transparent.neutral.content.headings};
  font-variant-numeric: lining-nums tabular-nums;
  white-space: nowrap;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const Group = styled('ul')`
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
