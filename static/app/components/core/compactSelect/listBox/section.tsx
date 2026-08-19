import {Fragment, useMemo} from 'react';
import type {AriaListBoxSectionProps} from '@react-aria/listbox';
import {useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {
  SectionGroup,
  SectionHeader,
  SectionSeparator,
  SectionTitle,
  SectionToggle,
  SectionWrap,
} from '@sentry/scraps/compactSelect';
import type {SelectKey} from '@sentry/scraps/compactSelect';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';

import {ListBoxOption, type ListBoxOptionProps} from './option';

interface ListBoxSectionProps<T extends ListItemBase> extends AriaListBoxSectionProps {
  hiddenOptions: Set<SelectKey>;
  item: Node<T>;
  listState: ListState<T>;
  showSectionHeaders: boolean;
  showSectionSeparators: boolean;
  size: ListBoxOptionProps['size'];
  unstyledSectionTitles: boolean;
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
  showSectionSeparators,
  showDetails = true,
  unstyledSectionTitles,
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
      {showSectionHeaders && showSectionSeparators && (
        <SectionSeparator {...separatorProps} />
      )}
      <SectionWrap {...itemProps} data-index={dataIndex} ref={ref}>
        {(item.rendered || showToggleAllButton) && showSectionHeaders && (
          <SectionHeader>
            {item.rendered && (
              <SectionTitle {...headingProps} unstyled={unstyledSectionTitles}>
                {item.rendered}
              </SectionTitle>
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
