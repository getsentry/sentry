import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {QueryClientProvider, useQuery, useQueryClient} from '@tanstack/react-query';

import {Client} from 'sentry/api';
import {QuickContextCommitRow} from 'sentry/components/discover/quickContextCommitRow';
import EventCause from 'sentry/components/events/eventCause';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import FeatureBadge from 'sentry/components/featureBadge';
import AssignedTo from 'sentry/components/group/assignedTo';
import {Body, Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconCheckmark, IconInfo, IconMute, IconNot} from 'sentry/icons';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {EventData} from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';

// Will extend this enum as we add contexts for more columns
export enum ContextType {
  ISSUE = 'issue',
  RELEASE = 'release',
}

const HOVER_DELAY: number = 400;

function isIssueContext(contextType: ContextType): boolean {
  return contextType === ContextType.ISSUE;
}

const fiveMinuteInMs = 5 * 60 * 1000;

type IssueContextProps = {
  api: Client;
  dataRow: EventData;
  eventID?: string;
};

function IssueContext(props: IssueContextProps) {
  const statusTitle = t('Issue Status');
  const {isLoading, isError, data} = useQuery({
    queryKey: ['quick-context-issue', `${props.dataRow['issue.id']}`],
    queryFn: () =>
      props.api.requestPromise(`/issues/${props.dataRow['issue.id']}/`, {
        method: 'GET',
        query: {
          collapse: 'release',
          expand: 'inbox',
        },
      }),
    onSuccess: group => {
      GroupStore.add([group]);
    },
    staleTime: fiveMinuteInMs,
    retry: false,
  });

  const renderStatus = () => (
    <IssueContextContainer data-test-id="quick-context-issue-status-container">
      <ContextTitle>
        {statusTitle}
        <FeatureBadge type="alpha" />
      </ContextTitle>
      <ContextBody>
        {data.status === 'ignored' ? (
          <IconMute data-test-id="quick-context-ignored-icon" color="gray500" size="sm" />
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

  const renderAssigneeSelector = () => (
    <IssueContextContainer data-test-id="quick-context-assigned-to-container">
      <AssignedTo group={data} projectId={data.project.id} />
    </IssueContextContainer>
  );

  const renderSuspectCommits = () =>
    props.eventID && (
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
    <Fragment>
      {renderStatus()}
      {renderAssigneeSelector()}
      {renderSuspectCommits()}
    </Fragment>
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

type ContextProps = {
  children: React.ReactNode;
  contextType: ContextType;
  dataRow: EventData;
  organization?: Organization;
};

export function QuickContextHoverWrapper(props: ContextProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [ishovering, setisHovering] = useState<boolean>(false);

  const handleHoverState = () => {
    setisHovering(prevState => !prevState);
  };

  useEffect(() => {
    return () => {
      queryClient.invalidateQueries({queryKey: ['quick-context-issue']});
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <HoverWrapper>
        {props.children}
        <StyledHovercard
          skipWrapper
          delay={HOVER_DELAY}
          body={
            <Wrapper data-test-id="quick-context-hover-body">
              {isIssueContext(props.contextType) ? (
                <IssueContext
                  api={api}
                  dataRow={props.dataRow}
                  eventID={props.dataRow.id}
                />
              ) : (
                <NoContextWrapper>{t('There is no context available.')}</NoContextWrapper>
              )}
            </Wrapper>
          }
        >
          <StyledIconInfo
            data-test-id="quick-context-hover-trigger"
            onMouseEnter={handleHoverState}
            onMouseLeave={handleHoverState}
            ishovering={ishovering ? 1 : 0}
            onClick={e => e.preventDefault()}
          />
        </StyledHovercard>
      </HoverWrapper>
    </QueryClientProvider>
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
