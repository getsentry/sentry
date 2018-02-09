import Reflux from 'reflux';

import {defined} from '../utils';
import SettingsIndicatorActions from '../actions/settingsIndicatorActions';

const SettingsIndicatorStore = Reflux.createStore({
  init() {
    this.state = null;
    this.model = null;
    this.id = null;
    this.listenTo(SettingsIndicatorActions.add, this.add);
    this.listenTo(SettingsIndicatorActions.undo, this.undo);
    this.listenTo(SettingsIndicatorActions.remove, this.remove);
  },

  add(message, type, options = {}) {
    if (options.model) {
      this.model = options.model;
    }
    this.id = options.id;

    this.state = {
      options: {
        ...options,

        // Use options, else default to disable if model does not exist
        disableUndo: defined(options.disableUno) ? options.disableUndo : !options.model,
      },
      message,
      type,
    };
    this.trigger(this.state);
  },

  remove() {
    // Do nothing if already null
    if (!this.state) return;

    this.state = null;
    this.trigger(this.state);
  },

  undo() {
    if (!this.model || !this.id) return;

    // Remove current messages
    this.remove();
    let oldValue = this.model.getValue(this.id);
    let didUndo = this.model.undo();
    let newValue = this.model.getValue(this.id);

    if (!didUndo) return;

    // billy: I don't like the store <-> model coupling
    let label = this.model.getDescriptor(this.id, 'label');
    if (!label) return;

    this.model.saveField(this.id, newValue).then(() => {
      this.add(`Restored ${label} from "${oldValue}" to "${newValue}"`, 'undo', 5000);
    });
  },
});

export default SettingsIndicatorStore;
