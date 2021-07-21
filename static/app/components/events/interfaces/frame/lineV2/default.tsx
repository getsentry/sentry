import styled from '@emotion/styled';

import {IconRefresh} from 'app/icons/iconRefresh';
import {tn} from 'app/locale';
import space from 'app/styles/space';
import {Frame} from 'app/types';
import {defined} from 'app/utils';

import DefaultTitle from '../defaultTitle';

import Expander from './expander';
import GroupingBadges from './groupingBadges';
import LeadHint from './leadHint';
import Wrapper from './wrapper';

type Props = React.ComponentProps<typeof Expander> &
  React.ComponentProps<typeof LeadHint> &
  Omit<React.ComponentProps<typeof GroupingBadges>, 'inApp'> & {
    frame: Frame;
    timesRepeated?: number;
    haveFramesAtLeastOneExpandedFrame?: boolean;
    haveFramesAtLeastOneGroupingBadge?: boolean;
  };

function Default({
  frame,
  nextFrame,
  isHoverPreviewed,
  isExpanded,
  platform,
  leadsToApp,
  timesRepeated,
  isPrefix,
  isSentinel,
  isUsedForGrouping,
  haveFramesAtLeastOneGroupingBadge,
  haveFramesAtLeastOneExpandedFrame,
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
    <Wrapper
      className="title"
      haveFramesAtLeastOneGroupingBadge={haveFramesAtLeastOneGroupingBadge}
      haveFramesAtLeastOneExpandedFrame={haveFramesAtLeastOneExpandedFrame}
    >
      <VertCenterWrapper>
        <div>
          <LeadHint
            isExpanded={isExpanded}
            nextFrame={nextFrame}
            leadsToApp={leadsToApp}
          />
          <DefaultTitle
            frame={frame}
            platform={platform}
            isHoverPreviewed={isHoverPreviewed}
          />
        </div>
        {renderRepeats()}
      </VertCenterWrapper>
      {haveFramesAtLeastOneGroupingBadge && (
        <GroupingBadges
          isPrefix={isPrefix}
          isSentinel={isSentinel}
          isUsedForGrouping={isUsedForGrouping}
        />
      )}
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
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    align-items: center;
  }
`;

const RepeatedContent = styled(VertCenterWrapper)`
  justify-content: center;
`;

const RepeatedFrames = styled('div')`
  display: inline-block;
  border-radius: 50px;
  padding: 1px 3px;
  margin-left: ${space(1)};
  border-width: thin;
  border-style: solid;
  border-color: ${p => p.theme.orange500};
  color: ${p => p.theme.orange500};
  background-color: ${p => p.theme.backgroundSecondary};
  white-space: nowrap;
`;

const StyledIconRefresh = styled(IconRefresh)`
  margin-right: ${space(0.25)};
`;
