import type * as React from 'react';
import {startTransition, useState} from 'react';

import {Search} from '@sentry/scraps/menu';

interface DropdownMenuSearchProps extends Omit<
  React.ComponentProps<typeof Search>,
  'value' | 'defaultValue' | 'onChange'
> {
  /** The search value when the field mounts. */
  initialValue: string;
  /** Called with the new search value, in a transition. */
  onSearch: (value: string) => void;
}

/**
 * The menu's search field. It keeps its own value, so typing re-renders only
 * the field. The menu filters its items in a transition: the field updates as
 * soon as a key is typed, and React can interrupt filtering a long menu when
 * the next key comes in.
 */
export function DropdownMenuSearch({
  initialValue,
  onSearch,
  ...props
}: DropdownMenuSearchProps) {
  const [value, setValue] = useState(initialValue);
  return (
    <Search
      {...props}
      value={value}
      onChange={event => {
        const next = event.target.value;
        setValue(next);
        startTransition(() => onSearch(next));
      }}
    />
  );
}
