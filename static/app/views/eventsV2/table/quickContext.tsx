import {Fragment, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {RequestOptions} from 'sentry/api';
import AvatarList from 'sentry/components/avatar/avatarList';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import AssignedTo from 'sentry/components/group/assignedTo';
import {Body, Hovercard} from 'sentry/components/hovercard';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TimeSince from 'sentry/components/timeSince';
import {IconCheckmark, IconInfo, IconMute, IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Group, Organization, ReleaseWithHealth} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';

// Will extend this enum as we add contexts for more columns
export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
}

const HOVER_DELAY: number = 400;
const DATA_FETCH_DELAY: number = 200;

function isIssueContext(contextType: ContextType): boolean {
  return contextType === ContextType.ISSUE;
}

function isReleaseContext(contextType: ContextType): boolean {
  return contextType === ContextType.RELEASE;
}

type RequestParams = {
  path: string;
  options?: RequestOptions;
};

// NOTE: Will extend when we add more type of contexts. Context is only relevant to issue and release columns for now.
function getRequestParams(
  dataRow: EventData,
  contextType: ContextType,
  organization?: Organization
): RequestParams {
  return isIssueContext(contextType)
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

type QuickContextProps = {
  contextType: ContextType;
  data: Group | ReleaseWithHealth | null;
  dataRow: EventData;
  error: boolean;
  loading: boolean;
};

export default function QuickContext({
  loading,
  error,
  data,
  contextType,
  dataRow,
}: QuickContextProps) {
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
      ) : data && isIssueContext(contextType) ? (
        <IssueContext data={data as Group} eventID={dataRow.id} />
      ) : data && isReleaseContext(contextType) ? (
        <ReleaseContext data={data as ReleaseWithHealth} />
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
    <IssueContextContainer data-test-id="quick-context-issue-status-container">
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
    <IssueContextContainer data-test-id="quick-context-assigned-to-container">
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

type ReleaseContextProps = {
  data: ReleaseWithHealth;
};

function ReleaseContext({data}: ReleaseContextProps) {
  const statusText = data.status === 'open' ? t('Active') : t('Archived');

  const getCommitAuthorTitle = () => {
    const {commitCount, authors} = data;
    const user = ConfigStore.get('user');
    const userInAuthors =
      data.authors.length >= 1 &&
      data.authors.find(author => author.id && user.id && author.id === user.id);
    return tct('[commitCount] [commitDesc] by [authorDesc]', {
      commitCount,
      commitDesc: commitCount !== 1 ? 'commits' : 'commit',
      authorDesc: userInAuthors
        ? `you and ${authors.length - 1} ${authors.length - 1 !== 1 ? 'others' : 'other'}`
        : `${authors.length} ${authors.length !== 1 ? 'authors' : 'author'}`,
    });
  };

  const renderReleaseDetails = () => (
    <ReleaseContextContainer data-test-id="quick-context-release-details-container">
      <ContextTitle>
        {t('Release Details')}
        <FeatureBadge type="alpha" />
      </ContextTitle>
      <ContextBody>
        <StyledKeyValueTable>
          <KeyValueTableRow keyName={t('Status')} value={statusText} />
          {data.status === 'open' && (
            <Fragment>
              <KeyValueTableRow
                keyName={t('Created')}
                value={<TimeSince date={data.dateCreated} />}
              />
              <KeyValueTableRow
                keyName={t('First Event')}
                value={data.firstEvent ? <TimeSince date={data.firstEvent} /> : '\u2014'}
              />
              <KeyValueTableRow
                keyName={t('Last Event')}
                value={data.lastEvent ? <TimeSince date={data.lastEvent} /> : '\u2014'}
              />
            </Fragment>
          )}
        </StyledKeyValueTable>
      </ContextBody>
    </ReleaseContextContainer>
  );

  const renderLastCommit = () =>
    data.lastCommit && (
      <ReleaseContextContainer data-test-id="quick-context-release-last-commit-container">
        <ContextTitle>{t('Last Commit')}</ContextTitle>
        <DataSection>
          <Panel>
            <QuickContextCommitRow commit={data.lastCommit} />
          </Panel>
        </DataSection>
      </ReleaseContextContainer>
    );

  const renderIssueCountAndAuthors = () => (
    <ReleaseContextContainer data-test-id="quick-context-release-issues-and-authors-container">
      <ContextRow>
        <div>
          <ContextTitle>{t('New Issues')}</ContextTitle>
          <ReleaseStatusBody>{data.newGroups}</ReleaseStatusBody>
        </div>
        <div>
          <ReleaseAuthorsTitle>{getCommitAuthorTitle()}</ReleaseAuthorsTitle>
          <ReleaseAuthorsBody>
            <AvatarList users={data.authors} />
          </ReleaseAuthorsBody>
        </div>
      </ContextRow>
    </ReleaseContextContainer>
  );

  return (
    <Fragment>
      {renderReleaseDetails()}
      {renderIssueCountAndAuthors()}
      {renderLastCommit()}
    </Fragment>
  );
}

type QuickContextHoverProps = {
  children: React.ReactNode;
  contextType: ContextType;
  dataRow: EventData;
  organization?: Organization;
};

export function QuickContextHoverWrapper(props: QuickContextHoverProps) {
  const api = useApi();
  const [ishovering, setisHovering] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<Group | ReleaseWithHealth | null>(null);
  const delayOpenTimeoutRef = useRef<number | undefined>(undefined);

  const handleHoverState = () => {
    setisHovering(prevState => !prevState);
  };

  const fetchData = () => {
    if (!data) {
      const params = getRequestParams(
        props.dataRow,
        props.contextType,
        props.organization
      );
      api
        .requestPromise(params.path, params.options)
        .then(response => {
          setData(response);
          if (isIssueContext(props.contextType)) {
            GroupStore.add([response]);
          }
        })
        .catch(() => {
          setError(true);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  };

  const handleMouseEnter = () => {
    handleHoverState();
    delayOpenTimeoutRef.current = window.setTimeout(() => {
      fetchData();
    }, DATA_FETCH_DELAY);
  };

  const handleMouseLeave = () => {
    handleHoverState();
    window.clearTimeout(delayOpenTimeoutRef.current);
  };

  return (
    <HoverWrapper>
      {props.children}
      <StyledHovercard
        skipWrapper
        delay={HOVER_DELAY}
        body={
          <QuickContext
            loading={loading}
            error={error}
            data={data}
            contextType={props.contextType}
            dataRow={props.dataRow}
          />
        }
      >
        <StyledIconInfo
          data-test-id="quick-context-hover-trigger"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          ishovering={ishovering ? 1 : 0}
          onClick={e => e.preventDefault()}
        />
      </StyledHovercard>
    </HoverWrapper>
  );
}

const ContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledHovercard = styled(Hovercard)`
  ${Body} {
    padding: 0;
  }
  min-width: 300px;
`;

const StyledIconInfo = styled(IconInfo)<{ishovering: number}>`
  color: ${p => (p.ishovering ? p.theme.gray300 : p.theme.gray200)};
`;

const HoverWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const IssueContextContainer = styled(ContextContainer)`
  ${SidebarSection.Wrap}, ${Panel}, h6 {
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

const StyledKeyValueTable = styled(KeyValueTable)`
  width: 100%;
  margin: 0;
`;

const ReleaseContextContainer = styled(ContextContainer)`
  ${Panel} {
    margin: 0;
    border: none;
    box-shadow: none;
  }

  ${DataSection} {
    padding: 0;
  }

  & + & {
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

const ReleaseAuthorsTitle = styled(ContextTitle)`
  max-width: 200px;
  text-align: right;
`;

const ContextRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const ContextBody = styled('div')`
  margin: ${space(1)} 0 0;
  width: 100%;
  text-align: left;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
`;

const ReleaseAuthorsBody = styled(ContextBody)`
  justify-content: right;
`;

const ReleaseStatusBody = styled('h4')`
  margin-bottom: 0;
`;

const StatusText = styled('span')`
  margin-left: ${space(1)};
  text-transform: capitalize;
`;

const Wrapper = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
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
