import {keyframes} from 'emotion';
import PropTypes from 'prop-types';
import React from 'react';
import posed, {PoseGroup} from 'react-pose';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import EventWaiter from 'app/views/onboarding/projectSetup/eventWaiter';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import testablePose from 'app/utils/testablePose';

const FirstEventIndicator = props => (
  <EventWaiter {...props}>
    {({firstIssue}) => <Indicator firstIssue={firstIssue} {...props} />}
  </EventWaiter>
);

FirstEventIndicator.propTypes = EventWaiter.propTypes;

const Indicator = ({firstIssue, ...props}) => (
  <PoseGroup preEnterPose="init">
    {!firstIssue ? (
      <Waiting key="waiting" />
    ) : (
      <Success key="recieved" firstIssue={firstIssue} {...props} />
    )}
  </PoseGroup>
);

Indicator.propTypes = {
  firstIssue: PropTypes.oneOfType([PropTypes.bool, PropTypes.object]),
};

const Waiting = props => (
  <StatusWrapper {...props}>
    <WaitingIndicator />
    <PosedText>{t('Waiting for verification event')}</PosedText>
  </StatusWrapper>
);

const Success = ({organization, firstIssue, ...props}) => (
  <StatusWrapper {...props}>
    <ReceivedIndicator src="icon-checkmark-sm" />
    <PosedText>{t('First event was received!')}</PosedText>
    {firstIssue !== true && (
      <PosedButton
        size="small"
        priority="primary"
        to={`/organizations/${organization.slug}/issues/${firstIssue.id}/`}
      >
        {t('Take me to my event')}
      </PosedButton>
    )}
  </StatusWrapper>
);

Success.propTypes = FirstEventIndicator.propTypes;

const indicatorPoses = testablePose({
  init: {opacity: 0, y: -10},
  enter: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
});

const PosedText = posed.div(indicatorPoses);

const StatusWrapper = styled(posed.div(testablePose({enter: {staggerChildren: 350}})))`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: 0.9em;
  /* This is a minor hack, but the line height is just *slightly* too low,
  making the text appear off center, so we adjust it just a bit */
  line-height: calc(0.9em + 1px);
`;

const pulse = keyframes`
  0% {
    transform: scale(0.1);
    opacity: 1
  }

  40%, 100% {
    transform: scale(0.8);
    opacity: 0;
  }
`;

const WaitingIndicator = styled(posed.div(indicatorPoses))`
  margin: 0 6px;
  height: 10px;
  width: 10px;
  border-radius: 50%;
  background: ${p => p.theme.redLight};
  position: relative;

  &:before {
    content: '';
    display: block;
    position: absolute;
    height: 100px;
    width: 100px;
    border-radius: 50%;
    top: -45px;
    left: -45px;
    border: 4px solid ${p => p.theme.redLight};
    transform-origin: center;
    animation: ${pulse} 3s ease-out infinite;
  }
`;

const PosedReceivedIndicator = posed(
  React.forwardRef((props, ref) => <InlineSvg {...props} innerRef={ref} />)
)(indicatorPoses);

const ReceivedIndicator = styled(PosedReceivedIndicator)`
  color: #fff;
  background: ${p => p.theme.green};
  border-radius: 50%;
  height: 20px;
  width: 20px;
  padding: 5px;
  margin: 0 2px;
`;

const PosedButton = posed(
  React.forwardRef((props, ref) => (
    <div ref={ref}>
      <Button {...props} />
    </div>
  ))
)(
  testablePose({
    init: {x: -20, opacity: 0},
    enter: {x: 0, opacity: 1},
  })
);

export {Indicator};

export default FirstEventIndicator;
