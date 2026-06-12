import {Fragment, useContext, useId, useMemo} from 'react';
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
  SelectFilterContext,
} from '@sentry/scraps/compactSelect';
import type {SelectKey} from '@sentry/scraps/compactSelect';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';

import {GridListOption, type GridListOptionProps} from './option';

interface GridListSectionProps<T extends ListItemBase> {
  listState: ListState<T>;
  node: Node<T>;
  size: GridListOptionProps<T>['size'];
  searchFocusedId?: string;
  searchFocusedKey?: SelectKey | null;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection<T extends ListItemBase>({
  node,
  listState,
  searchFocusedId,
  searchFocusedKey,
  size,
}: GridListSectionProps<T>) {
  const titleId = useId();
  const {separatorProps} = useSeparator({elementType: 'li'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    node.value?.showToggleAllButton;

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
            {showToggleAllButton && <SectionToggle item={node} listState={listState} />}
          </SectionHeader>
        )}
        <SectionGroup role="presentation">
          {childNodes.map(child => (
            <GridListOption
              key={child.key}
              node={child}
              listState={listState}
              size={size}
              forceFocused={child.key === searchFocusedKey}
              searchFocusedId={searchFocusedId}
            />
          ))}
        </SectionGroup>
      </SectionWrap>
    </Fragment>
  );
}
