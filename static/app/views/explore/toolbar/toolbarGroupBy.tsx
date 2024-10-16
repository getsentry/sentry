import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {IconAdd} from 'sentry/icons/iconAdd';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {useGroupBys} from 'sentry/views/explore/hooks/useGroupBys';

import {ColumnEditor} from '../components/columnEditor';
import {useSpanTags} from '../contexts/spanTagsContext';
import {useDragNDropColumns} from '../hooks/useDragNDropColumns';
import {useResultMode} from '../hooks/useResultsMode';

import {ToolbarHeader, ToolbarHeaderButton, ToolbarLabel, ToolbarSection} from './styles';

interface ToolbarGroupByProps {
  disabled?: boolean;
}

export function ToolbarGroupBy({disabled}: ToolbarGroupByProps) {
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');
  const [resultMode] = useResultMode();

  const {groupBys, setGroupBys} = useGroupBys();

  const {editableColumns, updateColumnAtIndex, deleteColumnAtIndex, swapColumnsAtIndex} =
    useDragNDropColumns({columns: groupBys});

  useEffect(() => {
    setGroupBys(editableColumns.map(({column}) => column).filter(defined));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableColumns]);

  const addGroupBy = useCallback(() => {
    setGroupBys([...groupBys, '']);
  }, [setGroupBys, groupBys]);

  return (
    <ToolbarSection data-test-id="section-group-by">
      <StyledToolbarHeader>
        <ToolbarLabel disabled={disabled}>{t('Group By')}</ToolbarLabel>
        <ToolbarHeaderButton
          disabled={disabled}
          size="zero"
          onClick={addGroupBy}
          borderless
          aria-label={t('Add Group')}
          icon={<IconAdd />}
        />
      </StyledToolbarHeader>
      <div>
        <ColumnEditor
          disabled={resultMode === 'samples'}
          columns={editableColumns}
          onColumnChange={updateColumnAtIndex}
          onColumnDelete={deleteColumnAtIndex}
          onColumnSwap={swapColumnsAtIndex}
          stringTags={stringTags}
          numberTags={numberTags}
        />
      </div>
    </ToolbarSection>
  );
}

const StyledToolbarHeader = styled(ToolbarHeader)`
  margin-bottom: ${space(1)};
`;
