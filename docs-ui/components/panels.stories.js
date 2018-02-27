import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Button from 'sentry-ui/buttons/button';
import Panel from 'application-root/views/settings/components/panel';
import PanelHeader from 'application-root/views/settings/components/panelHeader';
import PanelBody from 'application-root/views/settings/components/panelBody';
import PanelItem from 'application-root/views/settings/components/panelItem';
import Field from 'application-root/views/settings/components/forms/field';

storiesOf('New Settings/Panel', module)
  .add(
    'Basic Panel',
    withInfo({
      text: 'Basic Panel component used in most settings',
      propTablesExclude: [Button],
    })(() => (
      <Panel>
        <PanelHeader>Panel Header</PanelHeader>

        <PanelBody>
          <PanelItem>Panel Item</PanelItem>
          <PanelItem>Panel Item</PanelItem>
          <PanelItem>Panel Item</PanelItem>
        </PanelBody>
      </Panel>
    ))
  )
  .add(
    'Field',
    withInfo({
      text: 'Non-connected form field item',
      propTablesExclude: [Panel, PanelBody, PanelItem],
    })(() => (
      <Panel>
        <PanelHeader>Panel Header</PanelHeader>

        <PanelBody>
          <Field label="Label" help="This is a helpful description for this form field">
            <Button priority="danger">Remove</Button>
          </Field>

          <Field
            label="Label"
            help="Control will fill up all available space, so wrap with a `<div>` to have it behave like an inline-block element."
          >
            <div>
              <Button priority="danger">Remove</Button>
            </div>
          </Field>
        </PanelBody>
      </Panel>
    ))
  );
