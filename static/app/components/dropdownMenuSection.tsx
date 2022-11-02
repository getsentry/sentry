import styled from '@emotion/styled';
import {useMenuSection} from '@react-aria/menu';
import {Node} from '@react-types/shared';

import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import space from 'sentry/styles/space';

type Props = {
  children: React.ReactNode;
  node: Node<MenuItemProps>;
};

/**
 * A wrapper component for menu sections. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
function MenuSection({node, children}: Props) {
  const {itemProps, headingProps, groupProps} = useMenuSection({
    heading: node.rendered,
    'aria-label': node['aria-label'],
  });

  return (
    <MenuSectionWrap {...itemProps}>
      {node.rendered && <Heading {...headingProps}>{node.rendered}</Heading>}
      <Group {...groupProps}>{children}</Group>
    </MenuSectionWrap>
  );
}

export default MenuSection;

const MenuSectionWrap = styled('li')`
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

  ${MenuSectionWrap}:first-of-type & {
    margin-top: ${space(0.5)};
  }
`;

const Group = styled('ul')`
  list-style-type: none;
  padding: 0;
  margin: 0;
`;
