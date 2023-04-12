import {Fragment, useContext, useMemo} from 'react';
import {AriaListBoxSectionProps, useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {FormSize} from 'sentry/utils/theme';

import {SelectFilterContext} from '../list';
import {
  SectionGroup,
  SectionHeader,
  SectionSeparator,
  SectionTitle,
  SectionWrap,
} from '../styles';
import {SelectSection} from '../types';
import {SectionToggle} from '../utils';

import {ListBoxOption} from './option';

interface ListBoxSectionProps extends AriaListBoxSectionProps {
  item: Node<any>;
  listState: ListState<any>;
  size: FormSize;
  onToggle?: (section: SelectSection<React.Key>, type: 'select' | 'unselect') => void;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxSection({item, listState, onToggle, size}: ListBoxSectionProps) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: item.rendered,
    'aria-label': item['aria-label'],
  });

  const {separatorProps} = useSeparator({elementType: 'li'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    item.value.showToggleAllButton;

  const hiddenOptions = useContext(SelectFilterContext);
  const childItems = useMemo(
    () => [...item.childNodes].filter(child => !hiddenOptions.has(child.props.value)),
    [item.childNodes, hiddenOptions]
  );

  return (
    <Fragment>
      <SectionSeparator {...separatorProps} />
      <SectionWrap {...itemProps}>
        {(item.rendered || showToggleAllButton) && (
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
            />
          ))}
        </SectionGroup>
      </SectionWrap>
    </Fragment>
  );
}
