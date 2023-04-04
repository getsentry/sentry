import styled from '@emotion/styled';
import {Location} from 'history';

import Clipboard from 'sentry/components/clipboard';
import {Body, Hovercard} from 'sentry/components/hovercard';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Version from 'sentry/components/version';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView, {EventData} from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';

import EventContext from './eventContext';
import IssueContext from './issueContext';
import ReleaseContext from './releaseContext';
import {NoContextWrapper} from './styles';
import {ContextType} from './utils';

const HOVER_DELAY: number = 400;

type NoContextProps = {
  isLoading: boolean;
};

export const NoContext = ({isLoading}: NoContextProps) => {
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
};

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
    case ContextType.ISSUE:
      return (
        <HoverHeader
          title={t('Issue')}
          organization={organization}
          copyLabel={dataRow.issue}
          copyContent={dataRow.issue}
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

type HoverHeaderProps = {
  organization: Organization;
  title: string;
  copyContent?: string;
  copyLabel?: React.ReactNode;
  hideCopy?: boolean;
};

const HoverHeader = ({
  title,
  hideCopy = false,
  copyLabel,
  copyContent,
  organization,
}: HoverHeaderProps) => {
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
};

type ContextProps = {
  children: React.ReactNode;
  contextType: ContextType;
  dataRow: EventData;
  organization: Organization;
  eventView?: EventView;
  projects?: Project[];
};

export const QuickContextHoverWrapper = (props: ContextProps) => {
  const location = useLocation();
  const {dataRow, contextType, organization, projects, eventView} = props;

  return (
    <HoverWrapper>
      <StyledHovercard
        showUnderline
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
};

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
