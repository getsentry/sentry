import Reflux from 'reflux';
import SentryAppComponentsActions from 'app/actions/sentryAppComponentActions';

const SentryAppComponentsStore = Reflux.createStore({
  init() {
    this.items = [];
    this.listenTo(SentryAppComponentsActions.loadComponents, this.onLoadComponents);
  },

  getInitialState() {
    return this.items;
  },

  onLoadComponents(items) {
    this.items = items;
    this.trigger(items);
  },

  get(uuid) {
    return this.items.find(item => item.uuid === uuid);
  },

  getAll() {
    return this.items;
  },

  getComponentByType(type) {
    if (!type) {
      return this.getAll();
    }
    return this.items.filter(item => item.type === type);
  },
});

export default SentryAppComponentsStore;
