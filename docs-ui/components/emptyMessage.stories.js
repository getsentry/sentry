import React from 'react';

import {Panel, PanelHeader} from 'app/components/panels';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

storiesOf('EmptyMessage', module)
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
    'in panel with sub-description',
    withInfo('Put this in a panel for maximum effect')(() => (
      <Panel>
        <PanelHeader>Members</PanelHeader>
        <EmptyMessage
          title="Sentry is better with Friends"
          description="When you use sentry with friends, you'll find your world of possibilities expands!"
        />
      </Panel>
    ))
  );
