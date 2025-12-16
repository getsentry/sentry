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
  SectionWrap,
} from 'sentry/components/core/compactSelect/styles';
import type {SelectKey, SelectSection} from 'sentry/components/core/compactSelect/types';
import {SectionToggle} from 'sentry/components/core/compactSelect/utils';

import {ListBoxOption, type ListBoxOptionProps} from './option';

interface ListBoxSectionProps extends AriaListBoxSectionProps {
  hiddenOptions: Set<SelectKey>;
  item: Node<any>;
  listState: ListState<any>;
  showSectionHeaders: boolean;
  size: ListBoxOptionProps['size'];
  'data-index'?: number;
  onToggle?: (section: SelectSection<SelectKey>, type: 'select' | 'unselect') => void;
  ref?: React.Ref<HTMLLIElement>;
  showDetails?: boolean;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxSection({
  item,
  listState,
  onToggle,
  size,
  hiddenOptions,
  showSectionHeaders,
  showDetails = true,
  ref,
  'data-index': dataIndex,
}: ListBoxSectionProps) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: item.rendered,
    'aria-label': item['aria-label'],
  });

  const {separatorProps} = useSeparator({elementType: 'li'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    item.value.showToggleAllButton;

  const childItems = useMemo(
    () => [...item.childNodes].filter(child => !hiddenOptions.has(child.key)),
    [item.childNodes, hiddenOptions]
  );

  return (
    <Fragment>
      {showSectionHeaders && <SectionSeparator {...separatorProps} />}
      <SectionWrap {...itemProps} data-index={dataIndex} ref={ref}>
        {(item.rendered || showToggleAllButton) && showSectionHeaders && (
          <SectionHeader>
            {item.rendered && (
              <SectionTitle {...headingProps}>{item.rendered}</SectionTitle>
            )}
            {showToggleAllButton && (
              <SectionToggle item={item} listState={listState} onToggle={onToggle} />
            )}
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
