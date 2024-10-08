import {useCallback, useMemo} from 'react';

import {Button} from 'sentry/components/button';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';

import {useSpanTags} from '../contexts/spanTagsContext';

import {
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarGroupByProps {
  disabled?: boolean;
}

export function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  const tags = useSpanTags();

  const {groupBys, setGroupBys} = useGroupBys();

  const options: SelectOption<Field>[] = useMemo(() => {
    // These options aren't known to exist on this project but it was inserted into
    // the group bys somehow so it should be a valid options in the group bys.
    //
    // One place this may come from is when switching projects/environment/date range,
    // a tag may disappear based on the selection.
    const unknownOptions = groupBys
      .filter(groupBy => groupBy && !tags.hasOwnProperty(groupBy))
      .map(groupBy => {
        return {
          label: groupBy,
          value: groupBy,
        };
      });

    const knownOptions = Object.keys(tags).map(tagKey => {
      return {
        label: tagKey,
        value: tagKey,
      };
    });

    return [
      // hard code in an empty option
      {label: t('None'), value: ''},
      ...unknownOptions,
      ...knownOptions,
    ];
  }, [groupBys, tags]);

  const addGroupBy = useCallback(() => {
    setGroupBys([...groupBys, '']);
  }, [setGroupBys, groupBys]);

  const setGroupBy = useCallback(
    (i: number, {value}: SelectOption<Field>) => {
      const newGroupBys = groupBys.slice();
      newGroupBys[i] = value;
      setGroupBys(newGroupBys);
    },
    [setGroupBys, groupBys]
  );

  const deleteGroupBy = useCallback(
    (index: number) => {
      const newGroupBys = groupBys.filter((_, orgIndex) => index !== orgIndex);
      setGroupBys?.(newGroupBys);
    },
    [setGroupBys, groupBys]
  );

  return (
    <ToolbarSection data-test-id="section-group-by">
      <ToolbarHeader>
        <ToolbarLabel disabled={disabled}>{t('Group By')}</ToolbarLabel>
        <ToolbarHeaderButton
          disabled={disabled}
          size="zero"
          onClick={addGroupBy}
          borderless
          aria-label={t('Add Group')}
          icon={<IconAdd />}
        />
      </ToolbarHeader>
      <div>
        {groupBys.map((groupBy, index) => (
          <ToolbarRow key={index}>
            <CompactSelect
              searchable
              disabled={disabled}
              options={options}
              value={groupBy}
              onChange={newGroupBy => setGroupBy(index, newGroupBy)}
            />
            <Button
              borderless
              icon={<IconDelete />}
              size="zero"
              disabled={disabled || (groupBys.length <= 1 && groupBy === '')}
              onClick={() => deleteGroupBy(index)}
              aria-label={t('Remove Group')}
            />
          </ToolbarRow>
        ))}
      </div>
    </ToolbarSection>
  );
}
