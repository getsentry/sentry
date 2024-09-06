import {useCallback, useMemo} from 'react';

import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
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

export function ToolbarGroupBy() {
  // TODO: This should be loaded from context to avoid loading tags twice.
  const tags = useSpanFieldSupportedTags();

  const [groupBys, setGroupBys] = useGroupBys();

  const options: SelectOption<Field>[] = useMemo(() => {
    return [
      // hard code in an empty option
      {label: t('None'), value: ''},
      ...Object.entries(tags).map(([tagKey, tag]) => {
        return {
          label: tag.name,
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

  return (
    <ToolbarSection data-test-id="section-group-by">
      <ToolbarHeader>
        <ToolbarHeading>{t('Group By')}</ToolbarHeading>
        <ToolbarHeaderButton size="xs" onClick={addGroupBy} borderless>
          {t('+Add Group By')}
        </ToolbarHeaderButton>
      </ToolbarHeader>
      {groupBys.map((groupBy, index) => (
        <ToolbarRow rows={groupBys} setRows={setGroupBys} index={index} key={index}>
          <CompactSelect
            searchable
            size="md"
            options={options}
            value={groupBy}
            onChange={newGroupBy => setGroupBy(index, newGroupBy)}
          />
        </ToolbarRow>
      ))}
    </ToolbarSection>
  );
}
