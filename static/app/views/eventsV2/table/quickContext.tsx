import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Client} from 'sentry/api';
import AvatarList from 'sentry/components/avatar/avatarList';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import AssignedTo from 'sentry/components/group/assignedTo';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import {Body, Hovercard} from 'sentry/components/hovercard';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TimeSince from 'sentry/components/timeSince';
import {VersionHoverHeader} from 'sentry/components/versionHoverCard';
import {IconCheckmark, IconMute, IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Event, Group, Organization, ReleaseWithHealth, User} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';
import {useQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

// Will extend this enum as we add contexts for more columns
export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
  EVENT = 'event',
}

const HOVER_DELAY: number = 400;

function isReleaseContext(contextType: ContextType): boolean {
  return contextType === ContextType.RELEASE;
}

function getHoverBody(
  api: Client,
  dataRow: EventData,
  contextType: ContextType,
  organization?: Organization
) {
  const noContext = (
    <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>
  );
  switch (contextType) {
    case ContextType.ISSUE:
      return <IssueContext api={api} dataRow={dataRow} eventID={dataRow.id} />;
    case ContextType.RELEASE:
      return organization ? (
        <ReleaseContext api={api} dataRow={dataRow} organization={organization} />
      ) : (
        noContext
      );
    case ContextType.EVENT:
      return organization ? (
        <EventContext api={api} dataRow={dataRow} organization={organization} />
      ) : (
        noContext
      );
    default:
      return noContext;
  }
}

// NOTE: Will be adding switch cases as more contexts require headers.
function getHoverHeader(dataRow: EventData, contextType: ContextType) {
  return isReleaseContext(contextType) ? (
    <VersionHoverHeader releaseVersion={dataRow.release} />
  ) : null;
}

const fiveMinutesInMs = 5 * 60 * 1000;

type IssueContextProps = {
  api: Client;
  dataRow: EventData;
  eventID?: string;
};

function IssueContext(props: IssueContextProps) {
  const statusTitle = t('Issue Status');

  const {isLoading, isError, data} = useQuery<Group>(
    [
      `/issues/${props.dataRow['issue.id']}/`,
      {
        query: {
          collapse: 'release',
          expand: 'inbox',
        },
      },
    ],
    {
      onSuccess: group => {
        GroupStore.add([group]);
      },
      staleTime: fiveMinutesInMs,
      retry: false,
    }
  );

  const renderStatus = () =>
    data && (
      <IssueContextContainer data-test-id="quick-context-issue-status-container">
        <ContextTitle>
          {statusTitle}
          <FeatureBadge type="alpha" />
        </ContextTitle>
        <ContextBody>
          {data.status === 'ignored' ? (
            <IconMute
              data-test-id="quick-context-ignored-icon"
              color="gray500"
              size="sm"
            />
          ) : data.status === 'resolved' ? (
            <IconCheckmark color="gray500" size="sm" />
          ) : (
            <IconNot
              data-test-id="quick-context-unresolved-icon"
              color="gray500"
              size="sm"
            />
          )}
          <StatusText>{data.status}</StatusText>
        </ContextBody>
      </IssueContextContainer>
    );

  const renderAssigneeSelector = () =>
    data && (
      <IssueContextContainer data-test-id="quick-context-assigned-to-container">
        <AssignedTo group={data} projectId={data.project.id} />
      </IssueContextContainer>
    );

  const renderSuspectCommits = () =>
    props.eventID &&
    data && (
      <IssueContextContainer data-test-id="quick-context-suspect-commits-container">
        <EventCause
          project={data.project}
          eventId={props.eventID}
          commitRow={QuickContextCommitRow}
        />
      </IssueContextContainer>
    );

  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  return (
    <Wrapper data-test-id="quick-context-hover-body">
      {renderStatus()}
      {renderAssigneeSelector()}
      {renderSuspectCommits()}
    </Wrapper>
  );
}

type NoContextProps = {
  isLoading: boolean;
};

function NoContext({isLoading}: NoContextProps) {
  return isLoading ? (
    <NoContextWrapper>
      <LoadingIndicator
        data-test-id="quick-context-loading-indicator"
        hideMessage
        size={32}
      />
    </NoContextWrapper>
  ) : (
    <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
  );
}

type BaseContextProps = {
  api: Client;
  dataRow: EventData;
  organization: Organization;
};

function ReleaseContext(props: BaseContextProps) {
  const {isLoading, isError, data} = useQuery<ReleaseWithHealth>(
    [`/organizations/${props.organization.slug}/releases/${props.dataRow.release}/`],
    {
      staleTime: fiveMinutesInMs,
      retry: false,
    }
  );

  const getCommitAuthorTitle = () => {
    const user = ConfigStore.get('user');
    const commitCount = data?.commitCount || 0;
    let authorsCount = data?.authors.length || 0;

    const userInAuthors =
      data &&
      data.authors.length >= 1 &&
      data.authors.find((author: User) => author.id && user.id && author.id === user.id);

    if (userInAuthors) {
      authorsCount = authorsCount - 1;
      return authorsCount !== 1 && commitCount !== 1
        ? tct('[commitCount] commits by you and [authorsCount] others', {
            commitCount,
            authorsCount,
          })
        : commitCount !== 1
        ? tct('[commitCount] commits by you and 1 other', {
            commitCount,
          })
        : authorsCount !== 1
        ? tct('1 commit by you and [authorsCount] others', {
            authorsCount,
          })
        : t('1 commit by you and 1 other');
    }

    return (
      data &&
      (authorsCount !== 1 && commitCount !== 1
        ? tct('[commitCount] commits by [authorsCount] authors', {
            commitCount,
            authorsCount,
          })
        : commitCount !== 1
        ? tct('[commitCount] commits by 1 author', {
            commitCount,
          })
        : authorsCount !== 1
        ? tct('1 commit by [authorsCount] authors', {
            authorsCount,
          })
        : t('1 commit by 1 author'))
    );
  };

  const renderReleaseDetails = () => {
    const statusText = data?.status === 'open' ? t('Active') : t('Archived');
    return (
      <ReleaseContextContainer data-test-id="quick-context-release-details-container">
        <ContextTitle>
          {t('Release Details')}
          <FeatureBadge type="alpha" />
        </ContextTitle>
        <ContextBody>
          <StyledKeyValueTable>
            <KeyValueTableRow keyName={t('Status')} value={statusText} />
            {data?.status === 'open' && (
              <Fragment>
                <KeyValueTableRow
                  keyName={t('Created')}
                  value={<TimeSince date={data.dateCreated} />}
                />
                <KeyValueTableRow
                  keyName={t('First Event')}
                  value={
                    data.firstEvent ? <TimeSince date={data.firstEvent} /> : '\u2014'
                  }
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
  };

  const renderLastCommit = () =>
    data &&
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

  const renderIssueCountAndAuthors = () =>
    data && (
      <ReleaseContextContainer data-test-id="quick-context-release-issues-and-authors-container">
        <ContextRow>
          <div>
            <ContextTitle>{t('New Issues')}</ContextTitle>
            <ReleaseStatusBody>{data.newGroups}</ReleaseStatusBody>
          </div>
          <div>
            <ReleaseAuthorsTitle>{getCommitAuthorTitle()}</ReleaseAuthorsTitle>
            <ReleaseAuthorsBody>
              {data.commitCount === 0 ? (
                <IconNot color="gray500" size="md" />
              ) : (
                <AvatarList users={data.authors} />
              )}
            </ReleaseAuthorsBody>
          </div>
        </ContextRow>
      </ReleaseContextContainer>
    );

  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  return (
    <Wrapper data-test-id="quick-context-hover-body">
      {renderReleaseDetails()}
      {renderIssueCountAndAuthors()}
      {renderLastCommit()}
    </Wrapper>
  );
}

function EventContext(props: BaseContextProps) {
  const {isLoading, isError, data} = useQuery<Event>(
    [
      `/organizations/${props.organization.slug}/events/${props.dataRow['project.name']}:${props.dataRow.id}/`,
    ],
    {
      staleTime: fiveMinutesInMs,
    }
  );

  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  if (data?.type !== 'error') {
    return <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>;
  }

  const stackTrace = getStacktrace(data);

  return stackTrace ? (
    <StackTraceWrapper>
      <StackTracePreviewContent event={data} stacktrace={stackTrace} />
    </StackTraceWrapper>
  ) : (
    <NoContextWrapper>
      {t('There is no stack trace available for this event.')}
    </NoContextWrapper>
  );
}

type ContextProps = {
  children: React.ReactNode;
  contextType: ContextType;
  dataRow: EventData;
  organization?: Organization;
};

export function QuickContextHoverWrapper(props: ContextProps) {
  const api = useApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    return () => {
      GroupStore.reset();
      queryClient.clear();
    };
  }, [queryClient]);

  return (
    <HoverWrapper>
      <StyledHovercard
        showUnderline
        delay={HOVER_DELAY}
        header={getHoverHeader(props.dataRow, props.contextType)}
        body={getHoverBody(api, props.dataRow, props.contextType, props.organization)}
      >
        {props.children}
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
  min-width: max-content;
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

  ${CauseHeader} > h3,
  ${CauseHeader} > button {
    font-size: ${p => p.theme.fontSizeExtraSmall};
    font-weight: 600;
    text-transform: uppercase;
  }
`;

const ContextTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  justify-content: space-between;
  align-items: center;
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
  border-radius: ${p => p.theme.borderRadius};
  width: 300px;
  padding: ${space(1.5)};
`;

const NoContextWrapper = styled('div')`
  color: ${p => p.theme.subText};
  height: 50px;
  padding: ${space(1)};
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
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

const ReleaseAuthorsTitle = styled(ContextTitle)`
  max-width: 200px;
  text-align: right;
`;

const ContextRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const ReleaseAuthorsBody = styled(ContextBody)`
  justify-content: right;
`;

const ReleaseStatusBody = styled('h4')`
  margin-bottom: 0;
`;

const StackTraceWrapper = styled('div')`
  overflow: hidden;
  max-height: 300px;
  width: 500px;
  overflow-y: auto;
  .traceback {
    margin-bottom: 0;
    border: 0;
    box-shadow: none;
  }
`;
