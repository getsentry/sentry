import {Fragment, useMemo} from 'react';
import {useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {SectionHeader, SectionSeparator} from '@sentry/scraps/compactSelect/styles';
import type {SelectKey, ListItemBase} from '@sentry/scraps/compactSelect/types';
import {SectionToggle} from '@sentry/scraps/compactSelect/utils';
import {
  MenuSectionGroup,
  MenuSectionHeading,
  MenuSectionLayout,
} from '@sentry/scraps/menu/layout';

import {ListBoxOption, type ListBoxOptionProps} from './option';

interface ListBoxSectionProps<T extends ListItemBase> {
  hiddenOptions: Set<SelectKey>;
  item: Node<T>;
  listState: ListState<T>;
  showSectionHeaders: boolean;
  size: ListBoxOptionProps['size'];
  'data-index'?: number;
  ref?: React.Ref<HTMLLIElement>;
  showDetails?: boolean;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxSection<T extends ListItemBase>({
  item,
  listState,
  size,
  hiddenOptions,
  showSectionHeaders,
  showDetails = true,
  ref,
  'data-index': dataIndex,
}: ListBoxSectionProps<T>) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: item.rendered,
    'aria-label': item['aria-label'],
  });

  const {separatorProps} = useSeparator({elementType: 'li'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    item.value?.showToggleAllButton;

  const childItems = useMemo(
    () => [...item.childNodes].filter(child => !hiddenOptions.has(child.key)),
    [item.childNodes, hiddenOptions]
  );

  return (
    <Fragment>
      {showSectionHeaders && <SectionSeparator {...separatorProps} />}
      <MenuSectionLayout {...itemProps} data-index={dataIndex} ref={ref}>
        {(item.rendered || showToggleAllButton) && showSectionHeaders && (
          <SectionHeader>
            {item.rendered && (
              <MenuSectionHeading {...headingProps}>{item.rendered}</MenuSectionHeading>
            )}
            {showToggleAllButton && <SectionToggle item={item} listState={listState} />}
          </SectionHeader>
        )}
        <MenuSectionGroup {...groupProps}>
          {childItems.map(child => (
            <ListBoxOption
              key={child.key}
              item={child}
              listState={listState}
              size={size}
              showDetails={showDetails}
            />
          ))}
        </MenuSectionGroup>
      </MenuSectionLayout>
    </Fragment>
  );
}
