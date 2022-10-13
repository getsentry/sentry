import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';

import {TableColumn} from './types';

const UNKNOWN_ISSUE = 'unknown';

// Will extend this enum as we add contexts for more columns
export enum ColumnType {
  ISSUE = 'issue',
}

function isIssueContext(
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>
): boolean {
  return (
    column.column.kind === 'field' &&
    column.column.field === ColumnType.ISSUE &&
    dataRow.issue !== UNKNOWN_ISSUE
  );
}

export function hasContext(
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>
): boolean {
  return isIssueContext(dataRow, column);
}

type Props = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
};

export default function QuickContext(props: Props) {
  // Will add setter for error.
  const [error] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<{msg: string} | null>(null);

  useEffect(() => {
    const mockData = {msg: t('Displaying Context for issue.')};

    // Will replace with issue data.
    const timer = setTimeout(() => {
      setData(mockData);
      setLoading(false);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <ContextContainer>
      {loading ? (
        <NoContextWrapper>
          <LoadingIndicator hideMessage size={32} />
        </NoContextWrapper>
      ) : error ? (
        <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
      ) : isIssueContext(props.dataRow, props.column) && data ? (
        <NoContextWrapper>{data.msg}</NoContextWrapper>
      ) : (
        <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>
      )}
    </ContextContainer>
  );
}

const ContextContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  overflow: hidden;
  min-width: 200px;
`;

const NoContextWrapper = styled('div')`
  color: ${p => p.theme.subText};
  height: 50px;
  padding: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
`;
