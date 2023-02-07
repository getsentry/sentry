import {Fragment, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import {AriaListBoxSectionProps, useListBoxSection} from '@react-aria/listbox';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import space from 'sentry/styles/space';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from './control';
import {Option} from './option';

interface SectionProps extends AriaListBoxSectionProps {
  item: Node<any>;
  /**
   * (To be passed to Option.) Whether the list box (ul element) has focus. If not (e.g.
   * if the search input has focus), then Option will not have any focus effect.
   */
  listBoxHasFocus: boolean;
  listState: ListState<any>;
  size: FormSize;
}

/**
 * A <li /> element that functions as a list box section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useListBox.html
 */
export function Section({item, listState, listBoxHasFocus, size}: SectionProps) {
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
      <Separator {...separatorProps} />
      <SectionWrap {...itemProps}>
        {item.rendered && <SectionTitle {...headingProps}>{item.rendered}</SectionTitle>}
        <SectionGroup {...groupProps}>
          {filteredOptions.map(child => (
            <Option
              key={child.key}
              item={child}
              listState={listState}
              listBoxHasFocus={listBoxHasFocus}
              size={size}
            />
          ))}
        </SectionGroup>
      </SectionWrap>
    </Fragment>
  );
}

const Separator = styled('li')`
  list-style-type: none;
  border-top: solid 1px ${p => p.theme.innerBorder};
  margin: ${space(0.5)} ${space(1.5)};

  &:first-of-type {
    display: none;
  }
`;

const SectionTitle = styled('p')`
  display: inline-block;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  white-space: nowrap;
  margin: ${space(0.5)} ${space(1.5)};
  padding-right: ${space(1)};
`;

const SectionWrap = styled('li')`
  list-style-type: none;
`;

const SectionGroup = styled('ul')`
  margin: 0;
  padding: 0;
`;
