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
  const {data: tags} = useSpanTags();

  const {groupBys, setGroupBys} = useGroupBys();

  const options: SelectOption<Field>[] = useMemo(() => {
    return [
      // hard code in an empty option
      {label: t('None'), value: ''},
      ...Object.keys(tags).map(tagKey => {
        return {
          label: tagKey,
          value: tagKey,
        };
      }),
    ];
  }, [tags]);

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
