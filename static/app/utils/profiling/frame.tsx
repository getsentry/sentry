import type {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
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
  readonly package?: string;
  readonly module?: string;
  readonly resource?: string;
  readonly threadId?: number;
  readonly inline?: boolean;
  readonly instructionAddr?: string;
  readonly symbol?: string;
  readonly symbolAddr?: string;
  readonly symbolicatorStatus?: SymbolicatorStatus;

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
    this.package = frameInfo.package;
    this.module = frameInfo.module ?? frameInfo.image;
    this.threadId = frameInfo.threadId;
    this.path = frameInfo.path;
    this.instructionAddr = frameInfo.instructionAddr;
    this.symbol = frameInfo.symbol;
    this.symbolAddr = frameInfo.symbolAddr;
    this.symbolicatorStatus = frameInfo.symbolicatorStatus;

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
      if (this.name === '(garbage collector)' || this.name === '(root)') {
        this.is_application = false;
      }

      if (!this.name || this.name.startsWith('unknown ')) {
        this.name = t('<anonymous>');
      }
      // If the frame had no line or column, it was part of the native code, (e.g. calling String.fromCharCode)
      if (this.line === undefined && this.column === undefined) {
        this.name += ` ${t('[native code]')}`;
        this.is_application = false;
      }

      // Doing this on the frontend while we figure out how to do this on the backend/client properly
      // @TODO Our old node.js incorrectly sends file instead of path (fixed in SDK, but not all SDK's are upgraded :rip:)
      const pathOrFile = this.path || this.file;

      if (pathOrFile) {
        if (pathOrFile.startsWith('node:internal')) {
          this.is_application = false;
        }

        if (this.module === undefined && pathOrFile) {
          const match =
            /node_modules(\/|\\)(?<maybeScopeOrPackage>.*?)(\/|\\)((?<maybePackage>.*)((\/|\\)))?/.exec(
              pathOrFile
            );
          if (match?.groups) {
            const {maybeScopeOrPackage, maybePackage} = match.groups;

            if (maybeScopeOrPackage.startsWith('@')) {
              this.module = `${maybeScopeOrPackage}/${maybePackage}`;
            } else {
              this.module = match.groups.maybeScopeOrPackage;
            }
            this.is_application = false;
          }
        }

        // Extract the first component of node:namespace/pkg if there is one
        // else return just the node:namespace
        if (pathOrFile?.substring(0, 5) === 'node:') {
          let image = '';
          const l = pathOrFile.length;

          for (let i = 0; i < l; i++) {
            if (pathOrFile.charAt(i) === '/') {
              image += '/';
              i++;
              while (i < l && pathOrFile.charAt(i) !== '/') {
                image += pathOrFile.charAt(i);
                i++;
              }
              break;
            }
            image += pathOrFile.charAt(i);
          }

          if (image) {
            this.module = image;
          }
        }
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
