import {Fragment} from 'react';

import Button from 'sentry/components/button';
import Field from 'sentry/components/forms/field';
import {
  Panel,
  PanelAlert,
  PanelBody,
  PanelHeader,
  PanelItem,
  PanelTable,
} from 'sentry/components/panels';
import {IconTelescope} from 'sentry/icons';

import {_BulkController} from './bulkController.stories';

export default {
  title: 'Components/Tables/Panels',
  args: {
    dashedBorder: false,
  },
};

export const BasicPanel = ({...args}) => (
  <Panel {...args}>
    <PanelHeader>Panel Header</PanelHeader>

    <PanelBody>
      <PanelItem>Panel Item</PanelItem>
      <PanelItem>Panel Item</PanelItem>
      <PanelItem>Panel Item</PanelItem>
    </PanelBody>
  </Panel>
);
BasicPanel.parameters = {
  docs: {
    description: {
      story: 'Basic Panel component used in most settings',
    },
  },
};

export const PanelAlerts = ({...args}) => (
  <Panel {...args}>
    <PanelHeader>Panel Header</PanelHeader>

    <PanelBody>
      <PanelAlert type="info">Info Alert message</PanelAlert>
      <PanelAlert type="error">Error Alert message</PanelAlert>
      <PanelAlert type="warning">Warning Alert message</PanelAlert>
      <PanelAlert type="success">Success Alert message</PanelAlert>
      <PanelAlert type="info" icon={<IconTelescope size="md" />}>
        Custom Icon message
      </PanelAlert>
      <PanelItem>Panel Item</PanelItem>
    </PanelBody>
  </Panel>
);
PanelAlerts.parameters = {
  docs: {
    description: {
      story: 'Alert boxes inside a panel',
    },
  },
};

export const _PanelTable = () => (
  <Fragment>
    <PanelTable
      // eslint-disable-next-line react/jsx-key
      headers={[<div>Header #1</div>, 'Header #2', <div>Custom Header Wooooo</div>, '']}
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
      <div>Panel Item</div>
      <div>Panel Item</div>
    </PanelTable>

    <PanelTable headers={['Short', 'Longer heading name', '']}>
      <div>One Row</div>
      <div>One Row</div>
      <div>One Row</div>
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

    <_BulkController />
  </Fragment>
);
_PanelTable.parameters = {
  docs: {
    description: {
      story: 'A Panel for "tabular" data',
    },
  },
};

export const WithFields = ({...args}) => (
  <Panel {...args}>
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
);
_PanelTable.parameters = {
  docs: {
    description: {
      story: 'Non-connected form field item',
    },
  },
};
