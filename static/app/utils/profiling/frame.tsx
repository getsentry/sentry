import {trimPackage} from 'sentry/components/events/interfaces/frame/utils';
import type {SymbolicatorStatus} from 'sentry/components/events/interfaces/types';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

const ROOT_KEY = 'sentry root';
const BROWSER_EXTENSION_REGEXP = /^(@moz-extension:\/\/|chrome-extension:\/\/)/;
export class Frame {
  readonly key: string | number;
  readonly name: string;

  readonly column?: number;
  readonly file?: string;
  readonly inline?: boolean;
  readonly instructionAddr?: string;
  readonly is_application: boolean;
  readonly is_browser_extension?: boolean;
  readonly line?: number;
  readonly module?: string;
  readonly package?: string;
  readonly path?: string;
  readonly platform?: string;
  readonly resource?: string;
  readonly symbol?: string;
  readonly symbolAddr?: string;
  readonly symbolicatorStatus?: SymbolicatorStatus;
  readonly threadId?: number;

  readonly isRoot: boolean;

  readonly totalCallCount?: number;
  readonly totalCallDuration?: number;
  readonly averageCallDuration?: number;

  static Root = new Frame({
    key: ROOT_KEY,
    name: ROOT_KEY,
    is_application: false,
  });

  constructor(
    frame: Profiling.Frame,
    type?: 'mobile' | 'javascript' | 'node' | string,
    // In aggregate mode, we miss certain info like lineno/col and so
    // we need to make sure we don't try to use it or infer data based on it
    mode?: 'detailed' | 'aggregate'
  ) {
    this.key = frame.key;
    this.file = frame.file;
    this.name = frame.name;
    this.resource = frame.resource;
    this.line = frame.line;
    this.column = frame.column;
    this.is_application = !!frame.is_application;
    this.package = frame.package;
    this.module = frame.module ?? frame.image;
    this.threadId = frame.threadId;
    this.path = frame.path;
    this.platform = frame.platform;
    this.instructionAddr = frame.instructionAddr;
    this.symbol = frame.symbol;
    this.symbolAddr = frame.symbolAddr;
    this.symbolicatorStatus = frame.symbolicatorStatus;
    this.isRoot = this.key === ROOT_KEY;

    this.totalCallCount = frame.count;
    this.totalCallDuration = frame.weight;
    this.averageCallDuration =
      defined(frame.weight) && defined(frame.count)
        ? frame.count
          ? frame.weight / frame.count
          : 0
        : undefined;

    // We are remapping some of the keys as they differ between platforms.
    // This is a temporary solution until we adopt a unified format.
    if (frame.columnNumber && this.column === undefined) {
      this.column = frame.columnNumber;
    }
    if (frame.lineNumber && this.column === undefined) {
      this.line = frame.lineNumber;
    }
    if (frame.scriptName && this.column === undefined) {
      this.resource = frame.scriptName;
    }

    // If the frame is a web frame and there is no name associated to it, then it was likely invoked as an iife or anonymous callback as
    // most modern browser engines properly show anonymous functions when they are assigned to references (e.g. `let foo = function() {};`)
    if (type === 'javascript' || type === 'node') {
      if (this.name === '(garbage collector)' || this.name === '(root)') {
        this.is_application = false;
      }

      if (!this.name || this.name === 'unknown') {
        this.name = t('<anonymous>');
      }

      // If the frame had no line or column, it was part of the native code, (e.g. calling String.fromCharCode)
      if (this.line === undefined && this.column === undefined && mode !== 'aggregate') {
        this.name += ` ${t('[native code]')}`;
        this.is_application = false;
      }

      if (!this.file && this.path) {
        this.file = this.path;
      }

      this.is_browser_extension = !!(
        this.file && BROWSER_EXTENSION_REGEXP.test(this.file)
      );
      if (this.is_browser_extension && this.is_application) {
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

            if (maybeScopeOrPackage!.startsWith('@')) {
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

  getSourceLocation(): string {
    const trimmedPackage = this.package ? trimPackage(this.package) : this.package;
    const packageFileOrPath: string =
      this.file ?? this.module ?? trimmedPackage ?? this.path ?? '<unknown>';

    const line = typeof this.line === 'number' ? this.line : '<unknown line>';
    const column = typeof this.column === 'number' ? this.column : '<unknown column>';
    return `${packageFileOrPath}:${line}:${column}`;
  }
}
