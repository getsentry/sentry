import {useCallback, useMemo} from 'react';

import {Button} from 'sentry/components/button';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconDelete} from 'sentry/icons/iconDelete';
import {t} from 'sentry/locale';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';
import type {Field} from 'sentry/views/explore/hooks/useSampleFields';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';

import {
  ToolbarHeader,
  ToolbarHeaderButton,
  ToolbarHeading,
  ToolbarRow,
  ToolbarSection,
} from './styles';

interface ToolbarGroupByProps {
  disabled?: boolean;
}

export function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  // TODO: This should be loaded from context to avoid loading tags twice.
  const tags = useSpanFieldSupportedTags();

  const [groupBys, setGroupBys] = useGroupBys();

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
        <ToolbarHeading disabled={disabled}>{t('Group By')}</ToolbarHeading>
        <ToolbarHeaderButton
          disabled={disabled}
          size="xs"
          onClick={addGroupBy}
          borderless
        >
          {t('+Add Group By')}
        </ToolbarHeaderButton>
      </ToolbarHeader>
      <div>
        {groupBys.map((groupBy, index) => (
          <ToolbarRow key={index}>
            <CompactSelect
              searchable
              disabled={disabled}
              size="sm"
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
              aria-label={t('Remove')}
            />
          </ToolbarRow>
        ))}
      </div>
    </ToolbarSection>
  );
}
