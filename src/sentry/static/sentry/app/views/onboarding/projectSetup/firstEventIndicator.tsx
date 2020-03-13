import {keyframes} from '@emotion/core';
import React from 'react';
import posed, {PoseGroup} from 'react-pose';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Button from 'app/components/button';
import EventWaiter from 'app/views/onboarding/projectSetup/eventWaiter';
import InlineSvg from 'app/components/inlineSvg';
import space from 'app/styles/space';
import testablePose from 'app/utils/testablePose';
import {Group, Organization} from 'app/types';

type EventWaiterProps = Omit<React.ComponentProps<typeof EventWaiter>, 'children'>;
type FirstIssue = null | true | Group;

const FirstEventIndicator = (props: EventWaiterProps) => (
  <EventWaiter {...props}>
    {({firstIssue}) => <Indicator firstIssue={firstIssue} {...props} />}
  </EventWaiter>
);

const Indicator = ({
  firstIssue,
  ...props
}: EventWaiterProps & {firstIssue: FirstIssue}) => (
  <PoseGroup preEnterPose="init">
    {!firstIssue ? (
      <Waiting key="waiting" />
    ) : (
      <Success key="recieved" firstIssue={firstIssue} {...props} />
    )}
  </PoseGroup>
);

const StatusWrapper = styled(posed.div(testablePose({enter: {staggerChildren: 350}})))`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
  align-items: center;
  font-size: 0.9em;
  /* This is a minor hack, but the line height is just *slightly* too low,
  making the text appear off center, so we adjust it just a bit */
  line-height: calc(0.9em + 1px);
  /* Ensure the event waiter status is always the height of a button */
  height: ${space(4)};
`;

const Waiting = (props: React.ComponentProps<typeof StatusWrapper>) => (
  <StatusWrapper {...props}>
    <WaitingIndicator />
    <PosedText>{t('Waiting for verification event')}</PosedText>
  </StatusWrapper>
);

type SuccessProps = EventWaiterProps & {
  firstIssue: FirstIssue;
  organization: Organization;
};

const Success = ({organization, firstIssue, ...props}: SuccessProps) => (
  <StatusWrapper {...props}>
    <ReceivedIndicator src="icon-checkmark-sm" />
    <PosedText>{t('Event was received!')}</PosedText>
    {firstIssue && firstIssue !== true && (
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

const indicatorPoses = testablePose({
  init: {opacity: 0, y: -10},
  enter: {opacity: 1, y: 0},
  exit: {opacity: 0, y: 10},
});

const PosedText = posed.div(indicatorPoses);

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

const PosedReceivedIndicator = posed(InlineSvg)(indicatorPoses);

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
  React.forwardRef<HTMLDivElement>((props, ref) => (
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
