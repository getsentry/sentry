import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import BreadcrumbIcon from 'sentry/components/events/interfaces/breadcrumbs/breadcrumb/type/icon';
import {PanelTable} from 'sentry/components/panels';
import {getDetails} from 'sentry/components/replays/breadcrumbs/utils';
import PlayerRelativeTime from 'sentry/components/replays/playerRelativeTime';
import Truncate from 'sentry/components/truncate';
import {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import useExtractedCrumbHtml from 'sentry/utils/replays/hooks/useExtractedCrumbHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';

type Props = {
  replay: ReplayReader;
};

function DomMutations({replay}: Props) {
  const hiddenDivRef = useRef<HTMLDivElement>(null);
  const {isLoading, actions} = useExtractedCrumbHtml({
    replay,
    domRoot: hiddenDivRef.current,
  });

  const startTimestamp = replay.getEvent().startTimestamp;

  return (
    <Fragment>
      <HiddenReplayMountpoint ref={hiddenDivRef} />
      <StyledPanelTable
        isEmpty={actions.length === 0}
        emptyMessage={t('No DOM actions found.')}
        isLoading={isLoading}
        headers={[t('Action'), t('Selector'), t('HTML'), t('Timestamp')]}
      >
        {actions.map((mutation, i) => (
          <Fragment key={i}>
            <TitleContainer>
              <IconWrapper color={mutation.crumb.color}>
                <BreadcrumbIcon type={mutation.crumb.type} />
              </IconWrapper>
              <Title>{getDetails(mutation.crumb).title}</Title>
            </TitleContainer>

            <Column>
              <Truncate
                maxLength={30}
                leftTrim={(mutation.crumb.message || '').includes('>')}
                value={mutation.crumb.message || ''}
              />
            </Column>

            <Column>
              <HTMLCode>{mutation.html}</HTMLCode>
            </Column>

            <Column>
              <PlayerRelativeTime
                relativeTime={startTimestamp}
                timestamp={mutation.crumb.timestamp}
              />
              {}
            </Column>
          </Fragment>
        ))}
      </StyledPanelTable>
    </Fragment>
  );
}

const HiddenReplayMountpoint = styled('div')`
  position: fixed;
  inset: 0;
  width: 0;
  height: 0;
  overflow: hidden;
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: max-content max-content 1fr max-content;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Column = styled('div')`
  display: flex;
  align-items: flex-start;
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
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const HTMLCode = styled(
  ({children, className}: {children: string; className?: string}) => (
    <textarea className={className} readOnly>
      {children}
    </textarea>
  )
)`
  border: none;
  width: 100%;
  resize: vertical;

  font-family: ${p => p.theme.text.familyMono};
`;

export default DomMutations;
