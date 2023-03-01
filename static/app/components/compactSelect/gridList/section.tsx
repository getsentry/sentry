import {Fragment, useContext, useMemo} from 'react';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import domId from 'sentry/utils/domId';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../control';
import {SectionGroup, SectionSeparator, SectionTitle, SectionWrap} from '../styles';

import {GridListOption} from './option';

interface GridListSectionProps {
  listState: ListState<any>;
  node: Node<any>;
  size: FormSize;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection({node, listState, size}: GridListSectionProps) {
  const titleId = domId('grid-section-title-');
  const {separatorProps} = useSeparator({elementType: 'li'});

  const {filterOption} = useContext(SelectContext);
  const filteredOptions = useMemo(() => {
    return [...node.childNodes].filter(child => {
      return filterOption(child.props);
    });
  }, [node.childNodes, filterOption]);

  return (
    <Fragment>
      <SectionSeparator {...separatorProps} />
      <SectionWrap
        role="rowgroup"
        {...(node['aria-label']
          ? {'aria-label': node['aria-label']}
          : {'aria-labelledby': titleId})}
      >
        {node.rendered && (
          <SectionTitle id={titleId} aria-hidden>
            {node.rendered}
          </SectionTitle>
        )}
        <SectionGroup role="presentation">
          {filteredOptions.map(child => (
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
