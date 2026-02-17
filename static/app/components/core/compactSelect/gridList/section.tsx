import {useContext, useId, useMemo} from 'react';
import styled from '@emotion/styled';
import {useSeparator} from '@react-aria/separator';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {
  SectionGroup,
  SectionHeader,
  SectionTitle,
  SectionToggle,
  SectionWrap,
  SelectFilterContext,
} from '@sentry/scraps/compactSelect';
import type {SelectKey, SelectSection} from '@sentry/scraps/compactSelect';

import {GridListOption, type GridListOptionProps} from './option';

interface GridListSectionProps {
  listState: ListState<any>;
  node: Node<any>;
  size: GridListOptionProps['size'];
  'data-index'?: number;
  isFirst?: boolean;
  onToggle?: (section: SelectSection<SelectKey>, type: 'select' | 'unselect') => void;
  ref?: React.Ref<HTMLLIElement>;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection({
  node,
  listState,
  onToggle,
  size,
  ref,
  'data-index': dataIndex,
  isFirst = false,
}: GridListSectionProps) {
  const titleId = useId();
  const {separatorProps} = useSeparator({elementType: 'div'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    node.value.showToggleAllButton;

  const hiddenOptions = useContext(SelectFilterContext);
  const childNodes = useMemo(
    () => [...node.childNodes].filter(child => !hiddenOptions.has(child.key)),
    [node.childNodes, hiddenOptions]
  );

  return (
    <SectionWrap
      role="rowgroup"
      data-index={dataIndex}
      ref={ref}
      {...(node['aria-label']
        ? {'aria-label': node['aria-label']}
        : {'aria-labelledby': titleId})}
    >
      {!isFirst && <SectionSeparatorInner {...separatorProps} />}
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
  );
}

const SectionSeparatorInner = styled('div')`
  border-top: solid 1px ${p => p.theme.tokens.border.secondary};
  margin: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
`;
