import {Fragment, useContext, useMemo} from 'react';
import {AriaListBoxSectionProps, useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../control';
import {SectionGroup, SectionSeparator, SectionTitle, SectionWrap} from '../styles';

import {ListBoxOption} from './option';

interface ListBoxSectionProps extends AriaListBoxSectionProps {
  item: Node<any>;
  listState: ListState<any>;
  size: FormSize;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function ListBoxSection({item, listState, size}: ListBoxSectionProps) {
  const {itemProps, headingProps, groupProps} = useListBoxSection({
    heading: item.rendered,
    'aria-label': item['aria-label'],
  });

  const {separatorProps} = useSeparator({elementType: 'li'});

  const {filterOption} = useContext(SelectContext);
  const filteredOptions = useMemo(() => {
    return [...item.childNodes].filter(child => {
      return filterOption(child.props);
    });
  }, [item.childNodes, filterOption]);

  return (
    <Fragment>
      <SectionSeparator {...separatorProps} />
      <SectionWrap {...itemProps}>
        {item.rendered && <SectionTitle {...headingProps}>{item.rendered}</SectionTitle>}
        <SectionGroup {...groupProps}>
          {filteredOptions.map(child => (
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
