import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import {Panel, PanelHeader} from 'sentry/components/panels';
import {IconTelescope, IconUser} from 'sentry/icons';
import space from 'sentry/styles/space';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

export default {
  title: 'Views/Empty States/Empty Messages',
  component: EmptyMessage,
};

export const Default = () => (
  <div style={{background: '#fff'}}>
    <EmptyMessage>Nothing to see here</EmptyMessage>
  </div>
);

Default.storyName = 'Default';
Default.parameters = {
  docs: {
    description: {
      story: 'Super Generic',
    },
  },
};

export const InPanel = () => (
  <Panel>
    <PanelHeader>Audit Log</PanelHeader>
    <EmptyMessage>No critical actions taken in this period</EmptyMessage>
  </Panel>
);

InPanel.storyName = 'In Panel';

export const InPanelWithIcon = () => (
  <Panel>
    <PanelHeader>Members</PanelHeader>
    <EmptyMessage icon={<IconUser size="xl" />} size="large">
      Sentry is better with friends
    </EmptyMessage>
  </Panel>
);

InPanelWithIcon.storyName = 'In Panel - With Icon';
InPanel.parameters = {
  docs: {
    description: {
      story: 'Put this in a panel for maximum effect',
    },
  },
};

export const InPanelWithIconAndAction = () => (
  <Panel>
    <PanelHeader>Members</PanelHeader>
    <EmptyMessage
      icon={<IconUser size="xl" />}
      action={<Button priority="primary">Invite Members</Button>}
    >
      Sentry is better with friends
    </EmptyMessage>
  </Panel>
);

InPanelWithIconAndAction.storyName = 'In Panel - With Icon and Action';

export const InPanelWithTitleAndDescription = () => (
  <Panel>
    <PanelHeader>Members</PanelHeader>
    <EmptyMessage
      title="Sentry is better with Friends"
      description="When you use sentry with friends, you'll find your world of possibilities expands!"
    />
  </Panel>
);

InPanelWithTitleAndDescription.storyName = 'In Panel - With Title and Description';

export const InPanelWithEverything = () => (
  <Panel>
    <PanelHeader>Members</PanelHeader>
    <EmptyMessage
      icon={<IconUser size="xl" />}
      title="Sentry is better with friends!"
      description="When you use sentry with friends, you'll find your world of possibilities expands!"
      action={
        <Wrapper>
          <ButtonWrapper>
            <Button priority="primary">Invite Members</Button>
          </ButtonWrapper>
          <div>
            <Button>Learn More</Button>
          </div>
        </Wrapper>
      }
    />
  </Panel>
);

InPanelWithEverything.storyName = 'In Panel - With Everything';

export const InOnboardingMissingFunctionalityPanel = () => (
  <Panel dashedBorder>
    <EmptyMessage
      icon={<IconTelescope size="xl" />}
      title="You're missing out on crucial functionality!"
      description="Enable this feature now to get the most out of Sentry. What are you waiting for? Do it!"
      action={
        <Wrapper>
          <ButtonWrapper>
            <Button priority="primary">Enable it!</Button>
          </ButtonWrapper>
          <div>
            <Button>Learn More</Button>
          </div>
        </Wrapper>
      }
    />
  </Panel>
);

InOnboardingMissingFunctionalityPanel.storyName =
  'In Onboarding/Missing Functionality Panel';

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
`;

const ButtonWrapper = styled('div')`
  margin-right: ${space(1)};
`;
