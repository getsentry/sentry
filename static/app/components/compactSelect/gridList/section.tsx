import {Fragment, useContext, useMemo} from 'react';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import domId from 'sentry/utils/domId';
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

import {GridListOption} from './option';

interface GridListSectionProps {
  listState: ListState<any>;
  node: Node<any>;
  size: FormSize;
  onToggle?: (section: SelectSection<React.Key>, type: 'select' | 'unselect') => void;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection({node, listState, onToggle, size}: GridListSectionProps) {
  const titleId = domId('grid-section-title-');
  const {separatorProps} = useSeparator({elementType: 'li'});

  const showToggleAllButton =
    listState.selectionManager.selectionMode === 'multiple' &&
    node.value.showToggleAllButton;

  const hiddenOptions = useContext(SelectFilterContext);
  const childNodes = useMemo(
    () => [...node.childNodes].filter(child => !hiddenOptions.has(child.props.value)),
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
