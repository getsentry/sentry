import {ComponentProps, Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs, showPlayerTime} from 'sentry/components/replays/utils';
import ShortId from 'sentry/components/shortId';
import Tooltip from 'sentry/components/tooltip';
import {IconClose, IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import MessageFormatter from 'sentry/views/replays/detail/console/messageFormatter';
import StackTraceExpando from 'sentry/views/replays/detail/console/stackTraceExpando';

const ICONS = {
  error: <IconClose isCircled size="xs" />,
  warning: <IconWarning size="xs" />,
};

interface Props extends ComponentProps<typeof MessageFormatter> {
  hasOccurred: boolean;
  isActive: boolean;
  isCurrent: boolean;
  isLast: boolean;
  isOcurring: boolean;
  startTimestampMs: number;
}
function ConsoleMessage({
  breadcrumb,
  isActive = false,
  isOcurring = false,
  hasOccurred,
  isLast,
  isCurrent,
  startTimestampMs = 0,
}: Props) {
  const organization = useOrganization();
  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const diff = relativeTimeInMs(breadcrumb.timestamp || '', startTimestampMs);
  const handleOnClick = () => setCurrentTime(diff);
  const handleOnMouseOver = () => setCurrentHoverTime(diff);
  const handleOnMouseOut = () => setCurrentHoverTime(undefined);

  const timeHandlers = {
    isActive,
    isCurrent,
    isOcurring,
    hasOccurred,
  };

  return (
    <Fragment>
      <Icon
        isLast={isLast}
        level={breadcrumb.level}
        onMouseOver={handleOnMouseOver}
        onMouseOut={handleOnMouseOut}
        {...timeHandlers}
      >
        {ICONS[breadcrumb.level]}
      </Icon>
      <Message
        isLast={isLast}
        level={breadcrumb.level}
        onMouseOver={handleOnMouseOver}
        onMouseOut={handleOnMouseOut}
        aria-current={isCurrent}
        {...timeHandlers}
      >
        <StackTraceExpando issueId="123" organization={organization}>
          <ErrorBoundary mini>
            <MessageFormatter breadcrumb={breadcrumb} />
          </ErrorBoundary>
        </StackTraceExpando>
        <ViewIssueLink breadcrumb={breadcrumb} />
      </Message>
      <ConsoleTimestamp isLast={isLast} level={breadcrumb.level} {...timeHandlers}>
        <Tooltip title={<DateTime date={breadcrumb.timestamp} seconds />}>
          <ConsoleTimestampButton
            onClick={handleOnClick}
            onMouseOver={handleOnMouseOver}
            onMouseOut={handleOnMouseOut}
          >
            {showPlayerTime(breadcrumb.timestamp || '', startTimestampMs)}
          </ConsoleTimestampButton>
        </Tooltip>
      </ConsoleTimestamp>
    </Fragment>
  );
}

interface IssueLinkProps extends ComponentProps<typeof MessageFormatter> {}

function ViewIssueLink({breadcrumb}: IssueLinkProps) {
  const {projects} = useProjects();

  if (breadcrumb.category !== 'exception') {
    return null;
  }
  const project = projects.find(p => p.name === 'pokedex') || {
    slug: 'pokedex', // breadcrumb.project_name,
  };
  return (
    <LessPaddingHovercard
      forceVisible
      body={
        <ShortIdBreadrcumb>
          <ProjectBadge
            project={project}
            avatarSize={16}
            hideName
            avatarProps={{hasTooltip: true, tooltip: project.slug}}
          />
          <StyledShortId to="/" shortId="123" />
        </ShortIdBreadrcumb>
      }
    >
      <Button priority="link">View Details</Button>
    </LessPaddingHovercard>
  );
}

const ShortIdBreadrcumb = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const StyledShortId = styled(ShortId)`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const LessPaddingHovercard = styled(
  ({children, bodyClassName, ...props}: React.ComponentProps<typeof Hovercard>) => (
    <Hovercard bodyClassName={bodyClassName || '' + ' less-padding'} {...props}>
      {children}
    </Hovercard>
  )
)`
  .less-padding {
    padding: ${space(0.75)} ${space(1.5)};
  }
`;

const Common = styled('div')<{
  isActive: boolean;
  isCurrent: boolean;
  isLast: boolean;
  level: string;
  hasOccurred?: boolean;
  isOcurring?: boolean;
}>`
  background-color: ${p => p.theme.alert[p.level]?.backgroundLight || 'inherit'};
  color: ${({hasOccurred = true, ...p}) => {
    if (!hasOccurred) {
      return p.theme.gray300;
    }

    if (['warning', 'error'].includes(p.level)) {
      return p.theme.alert[p.level].iconHoverColor;
    }

    return 'inherit';
  }};

  transition: color 0.5s ease;

  border-bottom: ${p => {
    if (p.isCurrent) {
      return `1px solid ${p.theme.purple300}`;
    }

    if (p.isActive && !p.isOcurring) {
      return `1px solid ${p.theme.purple200}`;
    }

    if (p.isLast) {
      return 'none';
    }

    return `1px solid ${p.theme.innerBorder}`;
  }};
`;

const ConsoleTimestamp = styled(Common)`
  padding: ${space(0.25)} ${space(1)};
`;

const ConsoleTimestampButton = styled('button')`
  background: none;
  border: none;
`;

const Icon = styled(Common)<{isOcurring?: boolean}>`
  padding: ${space(0.5)} ${space(1)};
  position: relative;

  &:after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    height: 100%;
    width: ${space(0.5)};
    background-color: ${p => (p.isOcurring ? p.theme.focus : 'transparent')};
  }
`;
const Message = styled(Common)`
  padding: ${space(0.25)} 0;
  white-space: pre-wrap;
  word-break: break-word;
`;

export default ConsoleMessage;
