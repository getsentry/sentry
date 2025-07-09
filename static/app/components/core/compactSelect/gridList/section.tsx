import {Fragment, useContext, useId, useMemo} from 'react';
import {useSeparator} from '@react-aria/separator';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {SelectFilterContext} from 'sentry/components/core/compactSelect/list';
import {
  SectionGroup,
  SectionHeader,
  SectionSeparator,
  SectionTitle,
  SectionWrap,
} from 'sentry/components/core/compactSelect/styles';
import type {SelectKey, SelectSection} from 'sentry/components/core/compactSelect/types';
import {SectionToggle} from 'sentry/components/core/compactSelect/utils';

import {GridListOption, type GridListOptionProps} from './option';

interface GridListSectionProps {
  listState: ListState<any>;
  node: Node<any>;
  size: GridListOptionProps['size'];
  onToggle?: (section: SelectSection<SelectKey>, type: 'select' | 'unselect') => void;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection({node, listState, onToggle, size}: GridListSectionProps) {
  const titleId = useId();
  const {separatorProps} = useSeparator({elementType: 'li'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    node.value.showToggleAllButton;

  const hiddenOptions = useContext(SelectFilterContext);
  const childNodes = useMemo(
    () => [...node.childNodes].filter(child => !hiddenOptions.has(child.key)),
    [node.childNodes, hiddenOptions]
  );

  return (
    <Fragment>
      <SectionSeparator {...separatorProps} />
      <SectionWrap
        role="rowgroup"
        {...(node['aria-label']
          ? {'aria-label': node['aria-label']}
          : {'aria-labelledby': titleId})}
      >
        {(node.rendered || showToggleAllButton) && (
          <SectionHeader>
            {node.rendered && (
              <SectionTitle id={titleId} aria-hidden>
                {node.rendered}
              </SectionTitle>
            )}
            {showToggleAllButton && (
              <SectionToggle item={node} listState={listState} onToggle={onToggle} />
            )}
          </SectionHeader>
        )}
        <SectionGroup role="presentation">
          {childNodes.map(child => (
            <GridListOption
              key={child.key}
              node={child}
              listState={listState}
              size={size}
            />
          ))}
        </SectionGroup>
      </SectionWrap>
    </Fragment>
  );
}
