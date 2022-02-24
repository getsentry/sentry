import {t} from 'sentry/locale';

import {WeightedNode} from './weightedNode';

export class Frame extends WeightedNode {
  readonly key: string | number;
  readonly name: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly is_application: boolean;
  readonly image?: string;
  readonly resource?: string;

  static Root = new Frame(
    {
      key: 'sentry root',
      name: 'sentry root',
      is_application: false,
    },
    'mobile'
  );

  constructor(frameInfo: Profiling.FrameInfo, type?: 'mobile' | 'web') {
    super();

    this.key = frameInfo.key;
    this.file = frameInfo.file;
    this.name = frameInfo.name;
    this.resource = frameInfo.resource;
    this.line = frameInfo.line;
    this.column = frameInfo.column;
    this.is_application =
      type === 'web'
        ? frameInfo.line === undefined && frameInfo.column === undefined
        : !!frameInfo.is_application;
    this.image = frameInfo.image;

    if (type === 'web') {
      // If the frame is a web frame and there is no name associated to it, then it was likely invoked as an iife or anonymous callback as
      // most modern browser engines properly show anonymous functions when they are assigned to references (e.g. `let foo = function() {};`)
      if (!frameInfo.name) {
        this.name = t('anonymous');
      }
      // If the frame had no line or column, it was part of the native code, (e.g. calling String.fromCharCode)
      if (frameInfo.line === undefined && frameInfo.column === undefined) {
        this.name += ` ${t('[native code]')}`;
      }
    }
  }

  isRoot(): boolean {
    return Frame.Root === this;
  }
}
