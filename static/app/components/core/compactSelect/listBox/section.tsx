import {Fragment, useMemo} from 'react';
import {useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {
  SectionGroup,
  SectionHeader,
  SectionSeparator,
  SectionWrap,
} from '@sentry/scraps/compactSelect/styles';
import type {SelectKey, ListItemBase} from '@sentry/scraps/compactSelect/types';
import {SectionToggle} from '@sentry/scraps/compactSelect/utils';
import {MenuSectionLabel, MenuSectionSeparator} from '@sentry/scraps/menu';

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
  showSeparator?: boolean;
  useSharedSeparator?: boolean;
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
  showSeparator = true,
  useSharedSeparator = false,
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
      {showSectionHeaders &&
        showSeparator &&
        (useSharedSeparator ? (
          <MenuSectionSeparator />
        ) : (
          <SectionSeparator {...separatorProps} />
        ))}
      <SectionWrap {...itemProps} data-index={dataIndex} ref={ref}>
        {(item.rendered || showToggleAllButton) && showSectionHeaders && (
          <SectionHeader>
            {item.rendered && (
              <MenuSectionLabel id={headingProps.id}>{item.rendered}</MenuSectionLabel>
            )}
            {showToggleAllButton && <SectionToggle item={item} listState={listState} />}
          </SectionHeader>
        )}
        <SectionGroup {...groupProps}>
          {childItems.map(child => (
            <ListBoxOption
              key={child.key}
              item={child}
              listState={listState}
              size={size}
              showDetails={showDetails}
            />
          ))}
        </SectionGroup>
      </SectionWrap>
    </Fragment>
  );
}
