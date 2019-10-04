import Reflux from 'reflux';

import {Client} from 'app/api';
import OrganizationsActions from 'app/actions/organizationsActions';

const MemberListStore = Reflux.createStore({
  // listenables: MemberActions,

  init() {
    this.api = new Client();
    this.org = null;
    this.me = null;
    this.items = [];
    this.loaded = false;

    this.listenTo(OrganizationsActions.setActive, this.onSetActiveOrganization);
  },

  // TODO(dcramer): this should actually come from an action of some sorts
  loadInitialData(items) {
    this.items = items;
    this.loaded = true;
    this.trigger(this.items, 'initial');
  },

  getMe() {
    return this.me;
  },

  getById(id) {
    if (!this.items) {
      return null;
    }

    id = '' + id;
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].id === id) {
        return this.items[i];
      }
    }
    return null;
  },

  getByEmail(email) {
    if (!this.items) {
      return null;
    }

    email = email.toLowerCase();
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].email.toLowerCase() === email) {
        return this.items[i];
      }
    }
    return null;
  },

  getAll() {
    return this.items;
  },

  onSetActiveOrganization(org) {
    if (!org) {
      this.org = null;
      this.me = null;
    } else if (this.org !== org.id) {
      this.org = org.id;

      const endpoint = `/organizations/${org.slug}/members/me/`;
      this.api.requestPromise(endpoint, {method: 'GET'}).then(member => {
        if (member && member.user) {
          this.me = member;
          this.trigger(this.items, 'me');
        }
      });
    }
  },
});

export default MemberListStore;
