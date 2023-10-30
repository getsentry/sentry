import styled from '@emotion/styled';
import {useMenuSection} from '@react-aria/menu';
import {Node} from '@react-types/shared';

import {space} from 'sentry/styles/space';

import {MenuItemProps} from './item';

type DropdownMenuSectionProps = {
  children: React.ReactNode;
  node: Node<MenuItemProps>;
};

/**
 * A wrapper component for menu sections. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
function DropdownMenuSection({node, children}: DropdownMenuSectionProps) {
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

export default DropdownMenuSection;

const DropdownMenuSectionWrap = styled('li')`
  list-style-type: none;
`;

const Heading = styled('span')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${space(1)} ${space(1.5)} ${space(0.5)};
  padding-right: ${space(1)};

  ${DropdownMenuSectionWrap}:first-of-type & {
    margin-top: ${space(0.5)};
  }
`;

const Group = styled('ul')`
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
