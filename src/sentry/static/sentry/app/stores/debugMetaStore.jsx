import Reflux from 'reflux';

import {parseAddress} from 'app/components/events/interfaces/utils';

const DebugMetaActions = Reflux.createActions([
  'updateFilter',
  'updateImages',
  'updateFrames',
]);

const DebugMetaStore = Reflux.createStore({
  init() {
    this.reset();
    this.listenTo(DebugMetaActions.updateFilter, this.updateFilter);
    this.listenTo(DebugMetaActions.updateImages, this.updateImages);
    this.listenTo(DebugMetaActions.updateFrames, this.updateFrames);
  },

  reset() {
    this.filter = null;
    this.images = [];
    this.frames = [];
    this.trigger(this.get());
  },

  updateFilter(word) {
    this.filter = word;
    this.trigger(this.get());
  },

  updateImages(images) {
    this.images = images;
    this.trigger(this.get());
  },

  updateFrames(frames) {
    this.frames = frames;
    this.trigger(this.get());
  },

  calculateMaxLengthOfRelativeAddress() {
    return this.frames.reduce((maxLengthUntilThisPoint, frame) => {
      const correspondingImage = this.images.find(
        image => image.code_file === frame.package
      );

      try {
        const relativeAddress = (
          parseAddress(frame.instructionAddr) -
          parseAddress(correspondingImage.image_addr)
        ).toString(16);

        return maxLengthUntilThisPoint > relativeAddress.length
          ? maxLengthUntilThisPoint
          : relativeAddress.length;
      } catch {
        return maxLengthUntilThisPoint;
      }
    }, 0);
  },

  get() {
    return {
      filter: this.filter,
      images: this.images,
      frames: this.frames,
      maxLengthOfRelativeAddress: this.calculateMaxLengthOfRelativeAddress(),
    };
  },
});

export {DebugMetaActions, DebugMetaStore};
export default DebugMetaStore;
