import {Component} from 'react';
import {action} from '@storybook/addon-actions';
import PropTypes from 'prop-types';

import {
  Form as LegacyForm,
  TextField as LegacyTextField,
} from 'sentry/components/deprecatedforms';

class UndoButton extends Component {
  handleClick(e) {
    e.preventDefault();
    this.context.form.undo();
  }

  render() {
    return (
      <button type="button" onClick={this.handleClick.bind(this)}>
        Undo
      </button>
    );
  }
}

UndoButton.contextTypes = {
  form: PropTypes.object,
};

export default {
  title: 'Deprecated/Form',
};

export const Empty = () => <LegacyForm onSubmit={action('submit')} />;

Empty.storyName = 'empty';

export const WithCancel = () => (
  <LegacyForm onCancel={action('cancel')} onSubmit={action('submit')} />
);

WithCancel.storyName = 'with Cancel';
WithCancel.parameters = {
  docs: {
    description: {
      story: 'Adds a "Cancel" button when `onCancel` is defined',
    },
  },
};

export const SaveOnBlurAndUndo = () => (
  <LegacyForm saveOnBlur allowUndo>
    <LegacyTextField
      name="name"
      label="Team Name"
      placeholder="e.g. Operations, Web, Desktop"
      required
    />
    <LegacyTextField name="slug" label="Short name" placeholder="e.g. api-team" />
    <UndoButton />
  </LegacyForm>
);

SaveOnBlurAndUndo.storyName = 'save on blur and undo';
SaveOnBlurAndUndo.parameters = {
  docs: {
    description: {
      story: 'Saves on blur and has undo',
    },
  },
};
