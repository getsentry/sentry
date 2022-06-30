import {useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import Fuse from 'fuse.js';

import TextField from 'sentry/components/deprecatedforms/textField';
import space from 'sentry/styles/space';

import {IconData, iconGroups, IconPropName, iconProps, icons} from './data';
import IconInfoBox from './infoBox';

export type ExtendedIconData = IconData & {
  name: string;
  defaultProps?: Partial<Record<IconPropName, unknown>>;
};

type Results = {icons: ExtendedIconData[]; id: string; label?: string}[];

export type SelectedIcon = {
  group: string;
  icon: string;
};

const enumerateIconProps = (iconData: ExtendedIconData[], prop: string) =>
  iconData.reduce<ExtendedIconData[]>((acc, cur) => {
    const propData = iconProps[prop];

    switch (propData.type) {
      case 'select':
        const availableOptions: string[][] = cur.limitOptions?.[prop] ?? propData.options;

        return [
          ...acc,
          ...availableOptions.map(option => ({
            ...cur,
            id: `${cur.id}-${prop}-${option[0]}`,
            defaultProps: {
              ...cur.defaultProps,
              [prop]: option[0],
            },
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

// All the icons, split into iterable groups
const addIconNames = (iconData: IconData[]): ExtendedIconData[] =>
  iconData.map(icon => {
    const nameString = icon.id.split('-')[0];
    const name = nameString.charAt(0).toUpperCase() + nameString.slice(1);
    return {...icon, name};
  });

const groupedIcons: Results = iconGroups.map(group => {
  const filteredIcons = icons.filter(i => i.groups.includes(group.id));
  const namedIcons = addIconNames(filteredIcons);
  const enumeratedIcons = enumerateIconVariants(namedIcons);

  return {...group, icons: enumeratedIcons};
});

const fuse = new Fuse(icons, {keys: ['id', 'groups', 'keywords'], threshold: 0.3});

function SearchPanel() {
  // The same icon can appear in multiple groups, so we also need to store
  // which group the selected icon is in
  const [selectedIcon, setSelectedIcon] = useState<SelectedIcon>({group: '', icon: ''});

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
      <TextField
        name="query"
        placeholder="Search icons by name or similar keywords"
        value={query}
        onChange={value => {
          setQuery(value as string);
          setSelectedIcon({group: '', icon: ''});
        }}
      />

      {results.map(group => (
        <GroupWrap key={group.id}>
          <GroupLabel>{group.label}</GroupLabel>
          <GroupIcons>
            {group.icons.map(icon => (
              <IconInfoBox
                key={icon.id}
                icon={icon}
                selectedIcon={selectedIcon}
                setSelectedIcon={setSelectedIcon}
                groupId={group.id}
              />
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
  row-gap: ${space(1)};
  margin-top: ${space(1)};
`;
