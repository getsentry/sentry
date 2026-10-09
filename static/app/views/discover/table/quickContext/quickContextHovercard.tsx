import {lazy, type ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Body, Hovercard} from 'sentry/components/hovercard';
import {LazyLoad} from 'sentry/components/lazyLoad';
import {Version} from 'sentry/components/version';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {EventData, EventView} from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {useLocation} from 'sentry/utils/useLocation';

import {NoContext} from './noContext';
import {ContextType} from './utils';

// The body imports the issue, release and event context views (including the
// stack trace preview), so it's loaded on demand when a hovercard first opens.
const LazyQuickContextBody = lazy(() => import('./quickContextBody'));

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
};

function HoverHeader({title, copyLabel, copyContent, organization}: HoverHeaderProps) {
  return (
    <Flex align="center" justify="between">
      {title}
      <Flex flex="1" align="center" justify="end" gap="xs">
        {copyLabel}

        {copyContent && (
          <CopyToClipboardButton
            variant="transparent"
            aria-label={t('Copy to clipboard')}
            data-test-id="quick-context-hover-header-copy-button"
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
      </Flex>
    </Flex>
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
      header={getHoverHeader(dataRow, contextType, organization)}
      body={
        <LazyLoad
          LazyComponent={LazyQuickContextBody}
          loadingFallback={<NoContext isLoading />}
          contextType={contextType}
          dataRow={dataRow}
          organization={organization}
          eventView={eventView}
          location={location}
          projects={projects}
        />
      }
    >
      {children}
    </StyledHovercard>
  );
}

const StyledHovercard = styled(Hovercard)`
  ${Body} {
    padding: 0;
  }
  overflow: hidden;
  min-width: max-content;
`;

const StyledVersion = styled(Version)`
  max-width: 190px;
`;
