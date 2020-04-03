import styled from '@emotion/styled';
import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import {Panel, PanelHeader} from 'app/components/panels';
import {IconTelescope, IconUser} from 'app/icons';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import space from 'app/styles/space';

storiesOf('UI|EmptyMessage', module)
  .add(
    'default',
    withInfo('Super Generic')(() => (
      <div style={{background: '#fff'}}>
        <EmptyMessage>Nothing to see here</EmptyMessage>
      </div>
    ))
  )
  .add(
    'in panel',
    withInfo('Put this in a panel for maximum effect')(() => (
      <Panel>
        <PanelHeader>Audit Log</PanelHeader>
        <EmptyMessage>No critical actions taken in this period</EmptyMessage>
      </Panel>
    ))
  )
  .add(
    'in panel with icon',
    withInfo('Put this in a panel for maximum effect')(() => (
      <Panel>
        <PanelHeader>Members</PanelHeader>
        <EmptyMessage icon={<IconUser size="xl" />} size="large">
          Sentry is better with friends
        </EmptyMessage>
      </Panel>
    ))
  )
  .add(
    'in panel with icon and action',
    withInfo('Put this in a panel for maximum effect')(() => (
      <Panel>
        <PanelHeader>Members</PanelHeader>
        <EmptyMessage
          icon={<IconUser size="xl" />}
          action={<Button priority="primary">Invite Members</Button>}
        >
          Sentry is better with friends
        </EmptyMessage>
      </Panel>
    ))
  )
  .add(
    'in panel with title and description',
    withInfo('Put this in a panel for maximum effect')(() => (
      <Panel>
        <PanelHeader>Members</PanelHeader>
        <EmptyMessage
          title="Sentry is better with Friends"
          description="When you use sentry with friends, you'll find your world of possibilities expands!"
        />
      </Panel>
    ))
  )
  .add(
    'in panel with everything',
    withInfo('Put this in a panel for maximum effect')(() => (
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
    ))
  )
  .add(
    'in onboarding/missing functionality panel',
    withInfo('Put this in a panel for maximum effect')(() => (
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
    ))
  );

const Wrapper = styled('div')`
  display: flex;
  justify-content: center;
`;

const ButtonWrapper = styled('div')`
  margin-right: ${space(1)};
`;
