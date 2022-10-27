import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {RequestOptions} from 'sentry/api';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import AssignedTo from 'sentry/components/group/assignedTo';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark, IconMute, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';
import useApi from 'sentry/utils/useApi';

import {TableColumn} from './types';

const UNKNOWN_ISSUE = 'unknown';

// Will extend this enum as we add contexts for more columns
export enum ColumnType {
  ISSUE = 'issue',
  RELEASE = 'release',
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

// NOTE: Will add release column as an eligible column.
export function hasContext(
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>
): boolean {
  return isIssueContext(dataRow, column);
}

type RequestParams = {
  path: string;
  options?: RequestOptions;
};

// NOTE: Will extend when we add more type of contexts. Context is only relevant to issue and release columns for now.
function getRequestParams(
  dataRow: TableDataRow,
  column: TableColumn<keyof TableDataRow>,
  organization?: Organization
): RequestParams {
  return isIssueContext(dataRow, column)
    ? {
        path: `/issues/${dataRow['issue.id']}/`,
        options: {
          method: 'GET',
          query: {
            collapse: 'release',
            expand: 'inbox',
          },
        },
      }
    : {
        path: `/organizations/${organization?.slug}/releases/${dataRow.release}/`,
      };
}

type Props = {
  column: TableColumn<keyof TableDataRow>;
  dataRow: TableDataRow;
  organization?: Organization;
};

export default function QuickContext({column, dataRow, organization}: Props) {
  // Will add setter for error.
  const api = useApi();
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<Group | null>(null);

  // NOTE: Will extend when we add more type of contexts.

  useEffect(() => {
    // Track mounted state so we dont call setState on unmounted components
    let unmounted = false;

    const params = getRequestParams(dataRow, column, organization);
    api
      .requestPromise(params.path, params.options)
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
  }, [api, dataRow, column, organization]);

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
      ) : isIssueContext(dataRow, column) && data ? (
        <IssueContext data={data} eventID={dataRow.id} />
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
      <ContextTitle>
        {statusTitle}
        <FeatureBadge type="alpha" />
      </ContextTitle>
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
  ${SidebarSection.Wrap}, ${Panel} {
    margin: 0;
  }

  ${Panel} {
    border: none;
    box-shadow: none;
  }

  ${DataSection} {
    padding: 0;
  }

  ${CauseHeader}, ${SidebarSection.Title} {
    margin-top: ${space(2)};
  }
`;

const ContextTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  justify-content: space-between;
  align-items: center;
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
