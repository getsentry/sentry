import {Fragment, useContext, useMemo} from 'react';
import styled from '@emotion/styled';
import {useSeparator} from '@react-aria/separator';
import {ListState} from '@react-stately/list';
import {Node} from '@react-types/shared';

import {space} from 'sentry/styles/space';
import domId from 'sentry/utils/domId';
import {FormSize} from 'sentry/utils/theme';

import {SelectContext} from '../control';

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
      <Separator {...separatorProps} />
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
