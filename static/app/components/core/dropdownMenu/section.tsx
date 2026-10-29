import {useMenuSection} from '@react-aria/menu';
import type {Node} from '@react-types/shared';

import {SectionGroup, SectionLabel, SectionList} from '@sentry/scraps/menu';

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
    <SectionGroup {...itemProps}>
      {node.rendered && (
        <SectionLabel padding="md xl" size="md" {...headingProps}>
          {node.rendered}
        </SectionLabel>
      )}
      <SectionList gap="2xs" {...groupProps}>
        {children}
      </SectionList>
    </SectionGroup>
  );
}
