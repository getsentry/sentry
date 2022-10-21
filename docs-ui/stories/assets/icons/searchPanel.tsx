import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import Fuse from 'fuse.js';

import Input from 'sentry/components/input';
import space from 'sentry/styles/space';

import {IconData, iconGroups, IconPropName, iconProps, icons} from './data';
import IconEntry from './iconEntry';

export type ExtendedIconData = IconData & {
  name: string;
  defaultProps?: Partial<Record<IconPropName, unknown>>;
};

type Results = {icons: ExtendedIconData[]; id: string; label?: string}[];

export type SelectedIcon = {
  group: string;
  icon: string;
};

const enumerateIconProps = (iconData: ExtendedIconData[], prop: IconPropName) =>
  iconData.reduce<ExtendedIconData[]>((acc, cur) => {
    const propData = iconProps[prop];

    switch (propData.type) {
      case 'select':
        const availableOptions = cur.limitOptions?.[prop] ?? propData.options ?? [];

        return [
          ...acc,
          ...availableOptions.map(option => ({
            ...cur,
            id: `${cur.id}-${prop}-${option.value}`,
            defaultProps: {...cur.defaultProps, [prop]: option.value},
          })),
        ];
      case 'boolean':
        return [
          ...acc,
          {...cur, defaultProps: {...cur.defaultProps, [prop]: false}},
          {
            ...cur,
            id: `${cur.id}-${prop}`,
            defaultProps: {...cur.defaultProps, [prop]: true},
          },
        ];
      default:
        return acc;
    }
  }, []);

const enumerateIconVariants = (iconData: ExtendedIconData[]): ExtendedIconData[] =>
  iconData.reduce<ExtendedIconData[]>((acc, cur) => {
    let iconVariants: ExtendedIconData[] = [{...cur, defaultProps: {}}];

    cur.additionalProps?.forEach(prop => {
      if (iconProps[prop].enumerate) {
        iconVariants = enumerateIconProps(iconVariants, prop);
      }
    });

    return [...acc, ...iconVariants];
  }, []);

const addIconNames = (iconData: IconData[]): ExtendedIconData[] =>
  iconData.map(icon => {
    const nameString = icon.id.split('-')[0];
    const name = nameString.charAt(0).toUpperCase() + nameString.slice(1);
    return {...icon, name};
  });

// All the icons, split into iterable groups
const groupedIcons: Results = iconGroups.map(group => {
  const filteredIcons = icons.filter(i => i.groups.includes(group.id));
  const namedIcons = addIconNames(filteredIcons);
  const enumeratedIcons = enumerateIconVariants(namedIcons);

  return {...group, icons: enumeratedIcons};
});

const fuse = new Fuse(icons, {keys: ['id', 'groups', 'keywords'], threshold: 0.3});

function SearchPanel() {
  /**
   * Use Fuse.js to implement icon search
   */
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Results>(groupedIcons);

  const debouncedSearch = useCallback((newQuery: string) => {
    if (!newQuery) {
      setResults(groupedIcons);
    } else {
      const searchResults = fuse.search(newQuery).map(result => result.item);
      const namedIcons = addIconNames(searchResults);
      const enumeratedIcons = enumerateIconVariants(namedIcons);

      setResults([{id: 'search', icons: enumeratedIcons}]);
    }
  }, []);

  useEffect(() => void debouncedSearch(query), [query, debouncedSearch]);

  return (
    <Wrap>
      <Input
        name="query"
        placeholder="Search icons by name or similar keywords"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {results.map(group => (
        <GroupWrap key={group.id}>
          <GroupLabel>{group.label}</GroupLabel>
          <GroupIcons>
            {group.icons.map(icon => (
              <IconEntry key={icon.id} icon={icon} />
            ))}
          </GroupIcons>
        </GroupWrap>
      ))}
    </Wrap>
  );
}

export default SearchPanel;

export const Wrap = styled('div')`
  margin-top: ${space(4)};
`;

const GroupWrap = styled('div')`
  margin: ${space(4)} 0;
`;

const GroupLabel = styled('p')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  margin-bottom: 0;
`;

const GroupIcons = styled('div')`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${space(1)};
  margin-top: ${space(1)};
`;
