import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconCheckmark, IconMute, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import useApi from 'sentry/utils/useApi';

import {TableColumn} from './types';

const UNKNOWN_ISSUE = 'unknown';

// Will extend this enum as we add contexts for more columns
export enum ColumnType {
  ISSUE = 'issue',
}

type IssueData = {
  status: string;
};

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

// NOTE: Will extend when we add more type of contexts.
function getUrl(dataRow: TableDataRow, column: TableColumn<keyof TableDataRow>): string {
  return isIssueContext(dataRow, column) ? `/issues/${dataRow['issue.id']}/` : '';
}

function fetchData(
  api: Client,
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>
): Promise<IssueData> {
  const promise: Promise<IssueData> = api.requestPromise(getUrl(dataRow, column), {
    method: 'GET',
    query: {
      collapse: 'release',
      expand: 'inbox',
    },
  });

  return promise;
}

type Props = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
};

export default function QuickContext(props: Props) {
  // Will add setter for error.
  const api = useApi();
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<IssueData | null>(null);

  // NOTE: Will extend when we add more type of contexts.

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    fetchData(api, props.dataRow, props.column)
      .then(response => {
        if (unmounted) {
          return;
        }

        setData(response);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      // If component has unmounted, dont set state
      unmounted = true;
    };
  }, [api, props.dataRow, props.column]);

  return (
    <Wrapper>
      {loading ? (
        <NoContextWrapper>
          <LoadingIndicator hideMessage size={32} />
        </NoContextWrapper>
      ) : error ? (
        <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
      ) : isIssueContext(props.dataRow, props.column) && data ? (
        <IssueContext data={data} />
      ) : (
        <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>
      )}
    </Wrapper>
  );
}

// Only includes issue status context for now.
function IssueContext(props: {data: IssueData}) {
  const statusTitle = t('Issue Status');
  const {status} = props.data;

  return (
    <ContextContainer>
      <ContextTitle>{statusTitle}</ContextTitle>
      <ContextBody>
        {status === 'ignored' ? (
          <IconMute data-test-id="quick-context-ignored-icon" color="gray500" size="sm" />
        ) : status === 'resolved' ? (
          <IconCheckmark color="gray500" size="sm" />
        ) : (
          <IconNot
            data-test-id="quick-context-unresolved-icon"
            color="gray500"
            size="sm"
          />
        )}
        <StatusText>{status}</StatusText>
      </ContextBody>
    </ContextContainer>
  );
}

const ContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  margin: ${space(1.5)};
`;

const ContextTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const ContextBody = styled('div')`
  margin: ${space(1.5)} 0 0;
  width: 100%;
  text-align: left;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
`;

const StatusText = styled('span')`
  margin-left: ${space(1)};
  text-transform: capitalize;
`;

const Wrapper = styled('div')`
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
