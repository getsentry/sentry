import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import Button from 'app/components/button';
import {
  Panel,
  PanelHeader,
  PanelBody,
  PanelItem,
  PanelTable,
} from 'app/components/panels';
import Field from 'app/views/settings/components/forms/field';

storiesOf('UI|Panels', module)
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
    'Panel Table',
    withInfo({
      text: 'A Panel for "tabular" data',
    })(() => (
      <React.Fragment>
        <PanelTable
          // eslint-disable-next-line react/jsx-key
          headers={[<div>Header #1</div>, 'Header #2', <div>Custom Header Wooooo</div>]}
        >
          <div>Panel Item with really long content</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
        </PanelTable>

        <PanelTable
          isLoading
          // eslint-disable-next-line react/jsx-key
          headers={[<div>Header #1</div>, 'Header #2', <div>Custom Header Wooooo</div>]}
        >
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
        </PanelTable>

        <PanelTable
          isEmpty
          // eslint-disable-next-line react/jsx-key
          headers={[<div>Header #1</div>, 'Header #2', <div>Custom Header Wooooo</div>]}
        >
          <div>Panel Item</div>
          <div>Panel Item</div>
          <div>Panel Item</div>
        </PanelTable>
      </React.Fragment>
    ))
  )
  .add(
    'With Fields',
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
