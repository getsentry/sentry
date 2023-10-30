import styled from '@emotion/styled';

import {IconRefresh} from 'sentry/icons/iconRefresh';
import {tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Frame} from 'sentry/types';
import {defined} from 'sentry/utils';

import DefaultTitle from '../defaultTitle';

import Expander from './expander';
import LeadHint from './leadHint';
import Wrapper from './wrapper';

type Props = React.ComponentProps<typeof Expander> &
  React.ComponentProps<typeof LeadHint> & {
    frame: Frame;
    isUsedForGrouping: boolean;
    frameMeta?: Record<any, any>;
    onClick?: () => void;
    onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
    timesRepeated?: number;
  };

function Default({
  frame,
  nextFrame,
  isHoverPreviewed,
  isExpanded,
  platform,
  timesRepeated,
  isUsedForGrouping,
  leadsToApp,
  onMouseDown,
  onClick,
  frameMeta,
  event,
  ...props
}: Props) {
  function renderRepeats() {
    if (defined(timesRepeated) && timesRepeated > 0) {
      return (
        <RepeatedFrames
          title={tn('Frame repeated %s time', 'Frame repeated %s times', timesRepeated)}
        >
          <RepeatedContent>
            <StyledIconRefresh />
            <span>{timesRepeated}</span>
          </RepeatedContent>
        </RepeatedFrames>
      );
    }

    return null;
  }

  return (
    <Wrapper className="title" onMouseDown={onMouseDown} onClick={onClick}>
      <VertCenterWrapper>
        <Title>
          <LeadHint
            event={event}
            isExpanded={isExpanded}
            nextFrame={nextFrame}
            leadsToApp={leadsToApp}
          />
          <DefaultTitle
            frame={frame}
            platform={platform}
            isHoverPreviewed={isHoverPreviewed}
            isUsedForGrouping={isUsedForGrouping}
            meta={frameMeta}
          />
        </Title>
        {renderRepeats()}
      </VertCenterWrapper>
      <Expander
        isExpanded={isExpanded}
        isHoverPreviewed={isHoverPreviewed}
        platform={platform}
        {...props}
      />
    </Wrapper>
  );
}

export default Default;

const VertCenterWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const Title = styled('div')`
  > * {
    vertical-align: middle;
    line-height: 1;
  }
`;

const RepeatedContent = styled(VertCenterWrapper)`
  justify-content: center;
  margin-right: ${space(1)};
`;

const RepeatedFrames = styled('div')`
  display: inline-block;
  border-radius: 50px;
  padding: 1px 3px;
  margin-left: ${space(1)};
  border-width: thin;
  border-style: solid;
  border-color: ${p => p.theme.pink200};
  color: ${p => p.theme.pink400};
  background-color: ${p => p.theme.backgroundSecondary};
  white-space: nowrap;
`;

const StyledIconRefresh = styled(IconRefresh)`
  margin-right: ${space(0.25)};
`;
