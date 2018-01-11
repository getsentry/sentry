import Reflux from 'reflux';
import ApiMixin from '../mixins/apiMixin';

const GuideStore = Reflux.createStore({
  init() {
    this._internal = {
      step: -1,
      guide: {
        starting_message: 'Need help?',
        complete_message: 'Go to docs.sentry.io/learn/releases to learn more.',
        steps: [],
      },
    };
  },

  mixins: [ApiMixin],

  loadData(guide) {
    if (guide && JSON.stringify(this._internal.guide) != JSON.stringify(guide)) {
      this._internal.guide = guide;
      this.trigger(this._internal);
      console.log('loaded guide already sheesh');
    }
  },

  set(guide) {
    this._internal.guide = guide;
  },

  getCurrentStep() {
    if (this._internal.step >= 0) {
      return this._internal.guide.steps[this._internal.step];
    }
    return null;
  },

  getFirstStep() {
    return this._internal.guide.steps[0];
  },

  getCurrentGuide() {
    return this._internal.guide || null;
  },

  completeStep() {
    this._internal.step++;
    if (this._internal.step < this._internal.guide.steps.length) {
      console.log('outchea triggering dawg');
      this.trigger(this._internal);
    }
  },
});

export default GuideStore;
