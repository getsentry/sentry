import type * as React from 'react';
import {useId} from 'react';
import type {ListState} from '@react-stately/list';

import {SectionRow, type SelectSectionRow} from '@sentry/scraps/compactSelect/selectRows';
import type {ListItemBase} from '@sentry/scraps/compactSelect/types';
import {SectionGroup, SectionList} from '@sentry/scraps/menu';

interface GridListSectionProps<T extends ListItemBase> {
  children: React.ReactNode;
  listState: ListState<T>;
  section: SelectSectionRow<T>;
}

/**
 * A <li /> element that functions as a grid list section (renders a nested <ul />
 * inside). https://react-spectrum.adobe.com/react-aria/useGridList.html
 */
export function GridListSection<T extends ListItemBase>({
  children,
  listState,
  section,
}: GridListSectionProps<T>) {
  const titleId = useId();
  const ariaLabel = section.node['aria-label'];

  return (
    <SectionGroup
      role="rowgroup"
      {...(ariaLabel ? {'aria-label': ariaLabel} : {'aria-labelledby': titleId})}
    >
      <SectionRow
        section={section}
        listState={listState}
        labelProps={{id: titleId, 'aria-hidden': true}}
      />
      <SectionList>{children}</SectionList>
    </SectionGroup>
  );
}
