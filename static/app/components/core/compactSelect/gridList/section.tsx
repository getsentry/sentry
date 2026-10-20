import {Fragment, useContext, useId, useMemo} from 'react';
import {useSeparator} from '@react-aria/separator';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {SelectFilterContext} from '@sentry/scraps/compactSelect/selectFilterContext';
import {SectionSeparator} from '@sentry/scraps/compactSelect/styles';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {SectionToggle} from '@sentry/scraps/compactSelect/utils';
import {Menu} from '@sentry/scraps/menu';

import {GridListOption, type GridListOptionProps} from './option';

interface GridListSectionProps<T extends ListItemBase> {
  listState: ListState<T>;
  node: Node<T>;
  size: GridListOptionProps<T>['size'];
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection<T extends ListItemBase>({
  node,
  listState,
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
      <Menu.SectionGroup
        role="rowgroup"
        {...(node['aria-label']
          ? {'aria-label': node['aria-label']}
          : {'aria-labelledby': titleId})}
      >
        {(node.rendered || showToggleAllButton) && (
          <Menu.SectionHeader
            trailingAction={
              showToggleAllButton ? (
                <SectionToggle item={node} listState={listState} />
              ) : null
            }
          >
            {node.rendered && (
              <Menu.SectionLabel id={titleId} aria-hidden>
                {node.rendered}
              </Menu.SectionLabel>
            )}
          </Menu.SectionHeader>
        )}
        <Menu.SectionList>
          {childNodes.map(child => (
            <GridListOption
              key={child.key}
              node={child}
              listState={listState}
              size={size}
            />
          ))}
        </Menu.SectionList>
      </Menu.SectionGroup>
    </Fragment>
  );
}
