import type {ComponentProps} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Body, Hovercard} from 'sentry/components/hovercard';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventData} from 'sentry/utils/discover/eventView';
import type EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';

import EventContext from './eventContext';
import IssueContext from './issueContext';
import ReleaseContext from './releaseContext';
import {NoContextWrapper} from './styles';
import {ContextType} from './utils';

const HOVER_DELAY = 400;

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
          <CopyToClipboardButton
            borderless
            data-test-id="quick-context-hover-header-copy-button"
            iconSize="xs"
            onCopy={() => {
              trackAnalytics('discover_v2.quick_context_header_copy', {
                organization,
                clipBoardTitle: title,
              });
            }}
            size="zero"
            text={copyContent}
          />
        )}
      </HoverHeaderContent>
    </HoverHeaderWrapper>
  );
}

interface ContextProps extends ComponentProps<typeof Hovercard> {
  children: React.ReactNode;
  contextType: ContextType;
  dataRow: EventData;
  organization: Organization;
  eventView?: EventView;
  projects?: Project[];
}

export function QuickContextHovercard(props: ContextProps) {
  const location = useLocation();
  const {
    children,
    dataRow,
    contextType,
    organization,
    projects,
    eventView,
    ...hovercardProps
  } = props;

  return (
    <StyledHovercard
      {...hovercardProps}
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
      {children}
    </StyledHovercard>
  );
}

const StyledHovercard = styled(Hovercard)`
  ${Body} {
    padding: 0;
  }
  min-width: max-content;
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
