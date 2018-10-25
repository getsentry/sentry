import React from 'react';
import {Flex, Box} from 'grid-emotion';

import {Panel, PanelHeader} from 'app/components/panels';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

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
        <EmptyMessage icon="icon-user" size="large">
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
          icon="icon-user"
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
          icon="icon-user"
          title="Sentry is better with friends!"
          description="When you use sentry with friends, you'll find your world of possibilities expands!"
          action={
            <Flex justify="center">
              <Box mr={1}>
                <Button priority="primary">Invite Members</Button>
              </Box>
              <Box>
                <Button>Learn More</Button>
              </Box>
            </Flex>
          }
        />
      </Panel>
    ))
  )
  .add(
    'in onboarding/missing functionality panel',
    withInfo('Put this in a panel for maximum effect')(() => (
      <Panel dottedBorder>
        <EmptyMessage
          icon="icon-discover"
          title="You're missing out on crucial functionality!"
          description="Enable this feature now to get the most out of Sentry. What are you waiting for? Do it!"
          action={
            <Flex justify="center">
              <Box mr={1}>
                <Button priority="primary">Enable it!</Button>
              </Box>
              <Box>
                <Button>Learn More</Button>
              </Box>
            </Flex>
          }
        />
      </Panel>
    ))
  );
