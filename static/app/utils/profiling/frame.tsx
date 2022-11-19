import {t} from 'sentry/locale';

import {WeightedNode} from './weightedNode';

export class Frame extends WeightedNode {
  readonly key: string | number;
  readonly name: string;
  readonly file?: string;
  readonly line?: number;
  readonly column?: number;
  readonly is_application: boolean;
  readonly path?: string;
  readonly image?: string;
  readonly resource?: string;
  readonly threadId?: number;
  readonly inline?: boolean;

  static Root = new Frame(
    {
      key: 'sentry root',
      name: 'sentry root',
      is_application: false,
    },
    'mobile'
  );

  constructor(frameInfo: Profiling.FrameInfo, type?: 'mobile' | 'web' | 'node') {
    super();

    this.key = frameInfo.key;
    this.file = frameInfo.file;
    this.name = frameInfo.name;
    this.resource = frameInfo.resource;
    this.line = frameInfo.line;
    this.column = frameInfo.column;
    this.is_application = !!frameInfo.is_application;
    this.image = frameInfo.image;
    this.threadId = frameInfo.threadId;
    this.path = frameInfo.path;

    // We are remapping some of the keys as they differ between platforms.
    // This is a temporary solution until we adopt a unified format.
    if (frameInfo.columnNumber && this.column === undefined) {
      this.column = frameInfo.columnNumber;
    }
    if (frameInfo.lineNumber && this.column === undefined) {
      this.line = frameInfo.lineNumber;
    }
    if (frameInfo.scriptName && this.column === undefined) {
      this.resource = frameInfo.scriptName;
    }

    // If the frame is a web frame and there is no name associated to it, then it was likely invoked as an iife or anonymous callback as
    // most modern browser engines properly show anonymous functions when they are assigned to references (e.g. `let foo = function() {};`)
    if (type === 'web' || type === 'node') {
      if (!this.name || this.name.startsWith('unknown ')) {
        this.name = t('<anonymous>');
      }
      // If the frame had no line or column, it was part of the native code, (e.g. calling String.fromCharCode)
      if (this.line === undefined && this.column === undefined) {
        this.name += ` ${t('[native code]')}`;
      }
    }

    if (!this.name) {
      this.name = t('<unknown>');
    }
  }

  isRoot(): boolean {
    return this.name === Frame.Root.name;
  }
}
