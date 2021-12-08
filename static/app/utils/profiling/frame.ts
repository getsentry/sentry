import {WeightedNode} from './weightedNode';

export class Frame extends WeightedNode {
  key: string | number;
  name: string;
  file?: string;
  line?: number;
  column?: number;
  is_application: boolean;
  image?: string;
  resource?: string;
  recursive?: Frame;

  constructor(frameInfo: Profiling.FrameInfo, type: 'mobile' | 'web') {
    super();

    this.key = frameInfo.key;
    this.file = frameInfo.file;
    this.name = frameInfo.name;
    this.resource = frameInfo.resource;
    this.column = frameInfo.column;

    if (type === 'web') {
      if (!frameInfo.name) {
        this.name = 'anonymous';
      }
      if (frameInfo.line === undefined && frameInfo.column === undefined) {
        this.name += ' [native code]';
      }
    }

    this.line = frameInfo.line;
    this.is_application = !!frameInfo.is_application;
    this.image = frameInfo.image;
  }
}
