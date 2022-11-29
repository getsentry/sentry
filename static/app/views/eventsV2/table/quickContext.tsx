import {Fragment, useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import AvatarList from 'sentry/components/avatar/avatarList';
import Clipboard from 'sentry/components/clipboard';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import AssignedTo from 'sentry/components/group/assignedTo';
import {
  getStacktrace,
  StackTracePreviewContent,
} from 'sentry/components/groupPreviewTooltip/stackTracePreview';
import {Body, Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconAdd, IconCheckmark, IconCopy, IconMute, IconNot} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Event, Group, Organization, Project, ReleaseWithHealth, User} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import TraceMetaQuery from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import {getTraceTimeRangeFromEvent} from 'sentry/utils/performance/quickTrace/utils';
import {useQuery, useQueryClient} from 'sentry/utils/queryClient';
import toArray from 'sentry/utils/toArray';
import {useLocation} from 'sentry/utils/useLocation';
import {
  getStatusBodyText,
  HttpStatus,
} from 'sentry/views/performance/transactionDetails/eventMetas';
// Will extend this enum as we add contexts for more columns
export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
  EVENT = 'event',
}

const HOVER_DELAY: number = 400;

function getHoverBody(
  dataRow: EventData,
  contextType: ContextType,
  organization: Organization,
  location?: Location,
  projects?: Project[],
  eventView?: EventView
) {
  switch (contextType) {
    case ContextType.ISSUE:
      return <IssueContext dataRow={dataRow} organization={organization} />;
    case ContextType.RELEASE:
      return <ReleaseContext dataRow={dataRow} organization={organization} />;
    case ContextType.EVENT:
      return (
        <EventContext
          dataRow={dataRow}
          organization={organization}
          location={location}
          projects={projects}
          eventView={eventView}
        />
      );
    default:
      return <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>;
  }
}

// NOTE: Will be adding switch cases as more contexts require headers.
function getHoverHeader(
  dataRow: EventData,
  contextType: ContextType,
  organization: Organization
) {
  switch (contextType) {
    case ContextType.RELEASE:
      return (
        <HoverHeader
          title={t('Release')}
          organization={organization}
          copyLabel={<StyledVersion version={dataRow.release} truncate anchor={false} />}
          copyContent={dataRow.release}
        />
      );
    case ContextType.EVENT:
      return (
        dataRow.id && (
          <HoverHeader
            title={t('Event ID')}
            organization={organization}
            copyLabel={getShortEventId(dataRow.id)}
            copyContent={dataRow.id}
          />
        )
      );
    default:
      return null;
  }
}

const addFieldAsColumn = (
  fieldName: string,
  organization: Organization,
  location?: Location,
  eventView?: EventView
) => {
  trackAdvancedAnalyticsEvent('discover_v2.quick_context_add_column', {
    organization,
    column: fieldName,
  });

  const oldField = location?.query.field || eventView?.fields.map(field => field.field);
  const newField = toArray(oldField).concat(fieldName);
  browserHistory.push({
    ...location,
    query: {
      ...location?.query,
      field: newField,
    },
  });
};

const fiveMinutesInMs = 5 * 60 * 1000;

type HoverHeaderProps = {
  organization: Organization;
  title: string;
  copyContent?: string;
  copyLabel?: React.ReactNode;
  hideCopy?: boolean;
};

function HoverHeader({
  title,
  hideCopy = false,
  copyLabel,
  copyContent,
  organization,
}: HoverHeaderProps) {
  return (
    <HoverHeaderWrapper>
      {title}
      <HoverHeaderContent>
        {copyLabel}

        {!hideCopy && copyContent && (
          <Clipboard value={copyContent}>
            <IconCopy
              cursor="pointer"
              data-test-id="quick-context-hover-header-copy-icon"
              size="xs"
              onClick={() => {
                trackAdvancedAnalyticsEvent('discover_v2.quick_context_header_copy', {
                  organization,
                  clipBoardTitle: title,
                });
              }}
            />
          </Clipboard>
        )}
      </HoverHeaderContent>
    </HoverHeaderWrapper>
  );
}

function IssueContext(props: BaseContextProps) {
  const statusTitle = t('Issue Status');
  const {dataRow, organization} = props;

  const {
    isLoading: issueLoading,
    isError: issueError,
    data: issue,
  } = useQuery<Group>(
    [
      `/issues/${dataRow['issue.id']}/`,
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

  // NOTE: Suspect commits are generated from the first event of an issue.
  // Therefore, all events for an issue have the same suspect commits.
  const {
    isLoading: eventLoading,
    isError: eventError,
    data: event,
  } = useQuery<Event>([`/issues/${dataRow['issue.id']}/events/oldest/`], {
    staleTime: fiveMinutesInMs,
  });

  const renderStatus = () =>
    issue && (
      <IssueContextContainer data-test-id="quick-context-issue-status-container">
        <ContextHeader>{statusTitle}</ContextHeader>
        <ContextBody>
          {issue.status === 'ignored' ? (
            <IconMute
              data-test-id="quick-context-ignored-icon"
              color="gray500"
              size="sm"
            />
          ) : issue.status === 'resolved' ? (
            <IconCheckmark color="gray500" size="sm" />
          ) : (
            <IconNot
              data-test-id="quick-context-unresolved-icon"
              color="gray500"
              size="sm"
            />
          )}
          <StatusText>{issue.status}</StatusText>
        </ContextBody>
      </IssueContextContainer>
    );

  const renderAssigneeSelector = () =>
    issue && (
      <IssueContextContainer data-test-id="quick-context-assigned-to-container">
        <AssignedTo disableDropdown group={issue} projectId={issue.project.id} />
      </IssueContextContainer>
    );

  const renderSuspectCommits = () =>
    event &&
    event.eventID &&
    issue && (
      <IssueContextContainer data-test-id="quick-context-suspect-commits-container">
        <EventCause
          project={issue.project}
          eventId={event.eventID}
          commitRow={QuickContextCommitRow}
        />
      </IssueContextContainer>
    );

  const isLoading = issueLoading || eventLoading;
  const isError = issueError || eventError;
  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  return (
    <Wrapper
      onMouseEnter={() => {
        trackAdvancedAnalyticsEvent('discover_v2.quick_context_hover_contexts', {
          organization,
          contextType: ContextType.ISSUE,
        });
      }}
      data-test-id="quick-context-hover-body"
    >
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
  dataRow: EventData;
  organization: Organization;
};

function ReleaseContext(props: BaseContextProps) {
  const {dataRow, organization} = props;
  const {isLoading, isError, data} = useQuery<ReleaseWithHealth>(
    [`/organizations/${organization.slug}/releases/${dataRow.release}/`],
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

  const renderReleaseAuthors = () => {
    return (
      data && (
        <ReleaseContextContainer data-test-id="quick-context-release-details-container">
          <ReleaseAuthorsTitle>{getCommitAuthorTitle()}</ReleaseAuthorsTitle>
          <ReleaseAuthorsBody>
            {data.commitCount === 0 ? (
              <IconNot color="gray500" size="md" />
            ) : (
              <StyledAvatarList users={data.authors} maxVisibleAvatars={10} />
            )}
          </ReleaseAuthorsBody>
        </ReleaseContextContainer>
      )
    );
  };

  const renderLastCommit = () =>
    data &&
    data.lastCommit && (
      <ReleaseContextContainer data-test-id="quick-context-release-last-commit-container">
        <ContextHeader>{t('Last Commit')}</ContextHeader>
        <DataSection>
          <Panel>
            <QuickContextCommitRow commit={data.lastCommit} />
          </Panel>
        </DataSection>
      </ReleaseContextContainer>
    );

  const renderReleaseDetails = () =>
    data && (
      <ReleaseContextContainer data-test-id="quick-context-release-issues-and-authors-container">
        <ContextRow>
          <div>
            <ContextHeader>{t('Created')}</ContextHeader>
            <ReleaseBody>
              <TimeSince date={data.dateCreated} />
            </ReleaseBody>
          </div>
          <div>
            <ContextHeader>{t('Last Event')}</ContextHeader>
            <ReleaseBody>
              {data.lastEvent ? <TimeSince date={data.lastEvent} /> : '\u2014'}
            </ReleaseBody>
          </div>
          <div>
            <ContextHeader>{t('New Issues')}</ContextHeader>
            <ContextBody>{data.newGroups}</ContextBody>
          </div>
        </ContextRow>
      </ReleaseContextContainer>
    );

  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  return (
    <Wrapper
      onMouseEnter={() => {
        trackAdvancedAnalyticsEvent('discover_v2.quick_context_hover_contexts', {
          organization,
          contextType: ContextType.RELEASE,
        });
      }}
      data-test-id="quick-context-hover-body"
    >
      {renderReleaseDetails()}
      {renderReleaseAuthors()}
      {renderLastCommit()}
    </Wrapper>
  );
}

interface EventContextProps extends BaseContextProps {
  eventView?: EventView;
  location?: Location;
  projects?: Project[];
}

function EventContext(props: EventContextProps) {
  const {organization, dataRow, eventView, location, projects} = props;
  const {isLoading, isError, data} = useQuery<Event>(
    [
      `/organizations/${organization.slug}/events/${dataRow['project.name']}:${dataRow.id}/`,
    ],
    {
      staleTime: fiveMinutesInMs,
    }
  );

  if (isLoading || isError) {
    return <NoContext isLoading={isLoading} />;
  }

  if (data.type === 'transaction') {
    const traceId = data.contexts?.trace?.trace_id ?? '';
    const {start, end} = getTraceTimeRangeFromEvent(data);
    const project = projects?.find(p => p.slug === data.projectID);
    return (
      <Wrapper
        onMouseEnter={() => {
          trackAdvancedAnalyticsEvent('discover_v2.quick_context_hover_contexts', {
            organization,
            contextType: ContextType.RELEASE,
            eventType: 'transaction',
          });
        }}
        data-test-id="quick-context-hover-body"
      >
        <EventContextContainer>
          <ContextHeader>
            <Title>
              {t('Transaction Duration')}
              {!('transaction.duration' in dataRow) && (
                <Tooltip
                  skipWrapper
                  title={t('Add transaction duration as a column')}
                  position="right"
                >
                  <IconAdd
                    data-test-id="quick-context-transaction-duration-add-button"
                    cursor="pointer"
                    onClick={() =>
                      addFieldAsColumn(
                        'transaction.duration',
                        organization,
                        location,
                        eventView
                      )
                    }
                    color="gray300"
                    size="xs"
                    isCircled
                  />
                </Tooltip>
              )}
            </Title>
          </ContextHeader>
          <EventContextBody>
            {getDuration(data.endTimestamp - data.startTimestamp, 2, true)}
          </EventContextBody>
        </EventContextContainer>
        {location && (
          <EventContextContainer>
            <ContextHeader>
              <Title>
                {t('Status')}
                {!('http.status_code' in dataRow) && (
                  <Tooltip
                    skipWrapper
                    title={t('Add HTTP status code as a column')}
                    position="right"
                  >
                    <IconAdd
                      data-test-id="quick-context-http-status-add-button"
                      cursor="pointer"
                      onClick={() =>
                        addFieldAsColumn(
                          'http.status_code',
                          organization,
                          location,
                          eventView
                        )
                      }
                      color="gray300"
                      size="xs"
                      isCircled
                    />
                  </Tooltip>
                )}
              </Title>
            </ContextHeader>
            <EventContextBody>
              <ContextRow>
                <TraceMetaQuery
                  location={location}
                  orgSlug={organization.slug}
                  traceId={traceId}
                  start={start}
                  end={end}
                >
                  {metaResults => getStatusBodyText(project, data, metaResults?.meta)}
                </TraceMetaQuery>
                <HttpStatusWrapper>
                  (<HttpStatus event={data} />)
                </HttpStatusWrapper>
              </ContextRow>
            </EventContextBody>
          </EventContextContainer>
        )}
      </Wrapper>
    );
  }

  const stackTrace = getStacktrace(data);

  return stackTrace ? (
    <Fragment>
      {!dataRow.title && (
        <ErrorTitleContainer>
          <ContextHeader>
            <Title>
              {t('Title')}
              {!('title' in dataRow) && (
                <Tooltip skipWrapper title={t('Add title as a column')} position="right">
                  <IconAdd
                    data-test-id="quick-context-title-add-button"
                    cursor="pointer"
                    onClick={() =>
                      addFieldAsColumn('title', organization, location, eventView)
                    }
                    color="gray300"
                    size="xs"
                    isCircled
                  />
                </Tooltip>
              )}
            </Title>
          </ContextHeader>
          <ErrorTitleBody>{data.title}</ErrorTitleBody>
        </ErrorTitleContainer>
      )}
      <StackTraceWrapper
        onMouseEnter={() => {
          trackAdvancedAnalyticsEvent('discover_v2.quick_context_hover_contexts', {
            organization,
            contextType: ContextType.EVENT,
            eventType: 'error',
          });
        }}
      >
        <StackTracePreviewContent event={data} stacktrace={stackTrace} />
      </StackTraceWrapper>
    </Fragment>
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
  organization: Organization;
  eventView?: EventView;
  projects?: Project[];
};

export function QuickContextHoverWrapper(props: ContextProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const {dataRow, contextType, organization, projects, eventView} = props;

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
        displayTimeout={600}
        delay={HOVER_DELAY}
        header={getHoverHeader(dataRow, contextType, organization)}
        body={getHoverBody(
          dataRow,
          contextType,
          organization,
          location,
          projects,
          eventView
        )}
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

const ContextHeader = styled('h6')`
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

const ErrorTitleContainer = styled(ContextContainer)`
  padding: ${space(1.5)};
`;

const ErrorTitleBody = styled(ContextBody)`
  margin: 0;
  max-width: 450px;
  ${p => p.theme.overflowEllipsis}
`;

const ReleaseBody = styled(ContextBody)<{}>`
  font-size: 13px;
  color: ${p => p.theme.subText};
`;

const EventContextBody = styled(ContextBody)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  margin: 0;
  align-items: flex-start;
  flex-direction: column;
`;

const StatusText = styled('span')`
  margin-left: ${space(1)};
  text-transform: capitalize;
`;

const Wrapper = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  width: 320px;
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
  min-width: 320px;
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

const EventContextContainer = styled(ContextContainer)`
  & + & {
    margin-top: ${space(2)};
  }
`;

const ReleaseAuthorsTitle = styled(ContextHeader)`
  max-width: 200px;
  text-align: right;
`;

const ContextRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const ReleaseAuthorsBody = styled(ContextBody)`
  justify-content: left;
  margin: 0;
`;

const StyledAvatarList = styled(AvatarList)`
  margin: 0 ${space(0.75)};
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
  border-radius: ${p => p.theme.borderRadius};
`;

const Title = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const HttpStatusWrapper = styled('span')`
  margin-left: ${space(0.5)};
`;

const HoverHeaderWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const HoverHeaderContent = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
  gap: ${space(0.5)};
`;

const StyledVersion = styled(Version)`
  max-width: 190px;
`;
