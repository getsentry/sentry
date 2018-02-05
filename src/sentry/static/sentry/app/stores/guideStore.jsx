import Reflux from 'reflux';

const GuideStore = Reflux.createStore({
  init() {
    this._internal = {
      step: -1,
      guide: '',
    };
  },

  setGuide(guide) {
    this._internal.guide = guide;
    this._internal.step = 0;
    this.trigger(this._internal);
  },

  unSetGuide(guide) {
    this._internal.guide = '';
    this._internal.step = -1;
    this.trigger(this._internal);
  },

  setStep(step) {
    this._internal.step = step;
    this.trigger(this._internal);
  },
});

export default GuideStore;
window.gs = GuideStore;
