import {useMenuSection} from '@react-aria/menu';
import type {useSeparator} from '@react-aria/separator';
import type {Node} from '@react-types/shared';

import type {FlexProps} from '@sentry/scraps/layout';
import {Stack} from '@sentry/scraps/layout';
import {
  SectionGroup,
  SectionLabel,
  SectionList,
  SectionSeparator,
} from '@sentry/scraps/menu';

import type {MenuItemProps} from './item';

interface DropdownMenuSeparatorProps {
  separatorProps: ReturnType<typeof useSeparator>['separatorProps'];
  'data-index'?: number;
  ref?: React.Ref<HTMLLIElement>;
}

/**
 * The divider rendered between sections and their neighboring items.
 */
export function DropdownMenuSeparator({
  separatorProps,
  ref,
  'data-index': dataIndex,
}: DropdownMenuSeparatorProps) {
  return (
    <Stack
      ref={ref}
      data-index={dataIndex}
      as="li"
      justify="center"
      height="8px"
      padding="0 lg 0 xl"
      {...separatorProps}
      role="presentation"
    >
      <SectionSeparator />
    </Stack>
  );
}

type DropdownMenuSectionProps = {
  children: React.ReactNode;
  node: Node<MenuItemProps>;
  /**
   * Set by virtualized menus: `null` when the heading is scrolled out of view,
   * otherwise props that let the virtualizer measure the heading.
   */
  virtualHeadingProps?: {'data-index': number; ref: React.Ref<HTMLDivElement>} | null;
};

/**
 * A wrapper component for menu sections. See:
 * https://react-spectrum.adobe.com/react-aria/useMenu.html
 */
export function DropdownMenuSection({
  node,
  children,
  virtualHeadingProps,
}: DropdownMenuSectionProps) {
  const isVirtualized = virtualHeadingProps !== undefined;
  const showHeading = Boolean(node.rendered) && virtualHeadingProps !== null;
  // Keep the group labelled while a virtualized heading is scrolled out of view.
  const hiddenHeading =
    !showHeading && typeof node.rendered === 'string' ? node.rendered : undefined;
  const {itemProps, headingProps, groupProps} = useMenuSection({
    heading: showHeading ? node.rendered : undefined,
    'aria-label': node['aria-label'] ?? hiddenHeading,
  });

  const heading = showHeading && (
    <SectionLabel padding="md xl" size="md" {...headingProps}>
      {node.rendered}
    </SectionLabel>
  );
  // Virtualized rows carry their own spacing so the virtualizer can measure it.
  const gap: FlexProps['gap'] = isVirtualized ? '0' : '2xs';

  return (
    <SectionGroup ref={node.value?.ref} {...itemProps}>
      {heading && virtualHeadingProps ? (
        <div {...virtualHeadingProps}>{heading}</div>
      ) : (
        heading
      )}
      <SectionList gap={gap} {...groupProps}>
        {children}
      </SectionList>
    </SectionGroup>
  );
}
