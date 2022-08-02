import {useCallback} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import HTMLCode from 'sentry/components/htmlCode';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import {relativeTimeInMs} from 'sentry/components/replays/utils';
import Truncate from 'sentry/components/truncate';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import useExtractedCrumbHtml from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';

type Props = {
  replay: ReplayReader;
};

function DomMutations({replay}: Props) {
  const {isLoading, actions} = useExtractedCrumbHtml({replay});
  const {setCurrentTime, setCurrentHoverTime} = useReplayContext();

  const startTimestampMs = replay.getReplay().started_at.getTime();

  const handleMouseEnter = useCallback(
    (item: Crumb) => {
      if (startTimestampMs) {
        setCurrentHoverTime(relativeTimeInMs(item.timestamp ?? '', startTimestampMs));
      }
    },
    [setCurrentHoverTime, startTimestampMs]
  );

  const handleMouseLeave = useCallback(() => {
    setCurrentHoverTime(undefined);
  }, [setCurrentHoverTime]);

  const handleTimestampClick = useCallback(
    (crumb: Crumb) => {
      crumb.timestamp !== undefined
        ? setCurrentTime(relativeTimeInMs(crumb.timestamp, startTimestampMs))
        : null;
    },
    [setCurrentTime, startTimestampMs]
  );

  if (isLoading) {
    return null;
  }

  return (
    <MutationList>
      {actions.map((mutation, i) => (
        <MutationListItem
          key={i}
          onMouseEnter={() => handleMouseEnter(mutation.crumb)}
          onMouseLeave={handleMouseLeave}
        >
          <StepConnector />
          <MutationItemContainer>
            <div>
              <MutationMetadata>
                <IconWrapper color={mutation.crumb.color}>
                  <BreadcrumbIcon type={mutation.crumb.type} />
                </IconWrapper>
                <UnstyledButton onClick={() => handleTimestampClick(mutation.crumb)}>
                  <PlayerRelativeTime
                    relativeTimeMs={startTimestampMs}
                    timestamp={mutation.crumb.timestamp}
                  />
                </UnstyledButton>
              </MutationMetadata>
              <MutationDetails>
                <TitleContainer>
                  <Title>{getDetails(mutation.crumb).title}</Title>
                </TitleContainer>
                <Truncate
                  maxLength={30}
                  leftTrim={(mutation.crumb.message || '').includes('>')}
                  value={mutation.crumb.message || ''}
                />
              </MutationDetails>
            </div>
            <CodeContainer>
              <HTMLCode code={mutation.html} />
            </CodeContainer>
          </MutationItemContainer>
        </MutationListItem>
      ))}
    </MutationList>
  );
}

const MutationList = styled('ul')`
  list-style: none;
  position: relative;
  height: 100%;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding-left: 0;
  margin-bottom: 0;
`;

const MutationListItem = styled('li')`
  display: flex;
  align-items: start;
  padding: ${space(2)};
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const MutationItemContainer = styled('div')`
  display: grid;
  grid-template-columns: 280px 1fr;
`;

const MutationMetadata = styled('div')`
  display: flex;
  align-items: start;
  column-gap: ${space(1)};
`;

/**
 * Taken `from events/interfaces/.../breadcrumbs/types`
 */
const IconWrapper = styled('div')<Required<Pick<SVGIconProps, 'color'>>>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => p.theme.white};
  background: ${p => p.theme[p.color] ?? p.color};
  box-shadow: ${p => p.theme.dropShadowLightest};
  z-index: 1;
`;

const UnstyledButton = styled('button')`
  background: none;
  border: none;
  padding: 0;
`;

const MutationDetails = styled('div')`
  margin-left: 30px;
  margin-top: ${space(0.5)};
  margin-bottom: ${space(3)};
`;

const TitleContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(1)};
`;

const Title = styled('span')`
  ${p => p.theme.overflowEllipsis};
  text-transform: capitalize;
  color: ${p => p.theme.gray400};
  font-weight: bold;
  line-height: ${p => p.theme.text.lineHeightBody};
  margin-bottom: ${space(0.5)};
`;

const CodeContainer = styled('div')`
  overflow: auto;
  max-height: 400px;
  max-width: 100%;
`;

const StepConnector = styled('div')`
  position: absolute;
  height: 100%;
  top: 28px;
  left: 31px;
  border-right: 1px ${p => p.theme.gray200} dashed;
`;

export default DomMutations;
