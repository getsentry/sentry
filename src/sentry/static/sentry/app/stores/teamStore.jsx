import Reflux from 'reflux';
import TeamActions from 'app/actions/teamActions';

const TeamStore = Reflux.createStore({
  init() {
    this.initialized = false;
    this.reset();

    this.listenTo(TeamActions.updateSuccess, this.onUpdateSuccess);
    this.listenTo(TeamActions.fetchDetailsSuccess, this.onUpdateSuccess);
    this.listenTo(TeamActions.removeTeamSuccess, this.onRemoveSuccess);
    this.listenTo(TeamActions.createTeamSuccess, this.onCreateSuccess);
  },

  reset() {
    this.items = [];
  },

  loadInitialData(items) {
    this.initialized = true;
    this.items = items;
    this.trigger(new Set(items.map(item => item.id)));
  },

  onUpdateSuccess(itemId, response) {
    if (!response) return;

    let item = this.getBySlug(itemId);

    if (!item) {
      this.items.push(response);
    } else {
      // Slug was changed
      // Note: This is the proper way to handle slug changes but unfortunately not all of our
      // components use stores correctly. To be safe reload browser :((
      if (response.slug !== itemId) {
        // Remove old team
        this.items = this.items.filter(({slug}) => slug !== itemId);
        // Add team w/ updated slug
        this.items.push(response);
        this.trigger(new Set([response.slug]));
        return;
      }

      $.extend(true /*deep*/, item, response);
    }

    this.trigger(new Set([itemId]));
  },

  onRemoveSuccess(slug) {
    this.loadInitialData(this.items.filter(team => team.slug !== slug));
  },

  onCreateSuccess(team) {
    this.loadInitialData([...this.items, team]);
  },

  getById(id) {
    return this.items.find(item => item.id.toString() === id.toString()) || null;
  },

  getBySlug(slug) {
    return this.items.find(item => item.slug === slug) || null;
  },

  getActive() {
    return this.items.filter(item => item.isMember);
  },

  getAll() {
    return this.items;
  },
});

export default TeamStore;
