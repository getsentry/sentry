import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import AssignedTo from 'sentry/components/group/assignedTo';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark, IconMute, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Group} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import useApi from 'sentry/utils/useApi';

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

// NOTE: Will extend when we add more type of contexts.
function getUrl(dataRow: TableDataRow, column: TableColumn<keyof TableDataRow>): string {
  return isIssueContext(dataRow, column) ? `/issues/${dataRow['issue.id']}/` : '';
}

function fetchData(
  api: Client,
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>
): Promise<Group> {
  const promise: Promise<Group> = api.requestPromise(getUrl(dataRow, column), {
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
  const [data, setData] = useState<Group | null>(null);

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
        GroupStore.add([response]);
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
          <LoadingIndicator
            data-test-id="quick-context-loading-indicator"
            hideMessage
            size={32}
          />
        </NoContextWrapper>
      ) : error ? (
        <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
      ) : isIssueContext(props.dataRow, props.column) && data ? (
        <IssueContext data={data} eventID={props.dataRow.id} />
      ) : (
        <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>
      )}
    </Wrapper>
  );
}

type IssueContextProps = {
  data: Group;
  eventID?: string;
};

function IssueContext(props: IssueContextProps) {
  const statusTitle = t('Issue Status');
  const {status} = props.data;

  const renderStatus = () => (
    <IssueContextContainer>
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
    </IssueContextContainer>
  );

  const renderAssigneeSelector = () => (
    <IssueContextContainer>
      <AssignedTo group={props.data} projectId={props.data.project.id} />
    </IssueContextContainer>
  );

  const renderSuspectCommits = () =>
    props.eventID && (
      <IssueContextContainer data-test-id="quick-context-suspect-commits-container">
        <EventCause
          project={props.data.project}
          eventId={props.eventID}
          commitRow={QuickContextCommitRow}
        />
      </IssueContextContainer>
    );

  return (
    <Fragment>
      {renderStatus()}
      {renderAssigneeSelector()}
      {renderSuspectCommits()}
    </Fragment>
  );
}

const ContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const IssueContextContainer = styled(ContextContainer)`
  ${SidebarSection.Wrap}, ${Panel}, ${SidebarSection.Title} {
    margin: 0;
  }

  ${Panel} {
    border: none;
    box-shadow: none;
  }

  ${DataSection} {
    padding: 0;
  }

  &:not(:last-child):not(:first-child),
  ${CauseHeader} {
    margin-top: ${space(2)};
  }
`;

const ContextTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const ContextBody = styled('div')`
  margin: ${space(1)} 0 0;
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
  width: 300px;
  padding: ${space(1.5)};
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
