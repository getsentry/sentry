import * as Sentry from '@sentry/react';
import {fill, isThenable, loadModule} from '@sentry/utils';

export function instrumentUserEvent(): void {
  const pkg = loadModule<any>('@testing-library/user-event');
  ACTIONS.forEach((action: Action) => _patchAction(pkg.default, action));
}

type Action = (typeof ACTIONS)[number];

const ACTIONS = [
  'click',
  'dblClick',
  'type',
  'clear',
  'tab',
  'hover',
  'unhover',
  'upload',
  'selectOptions',
  'deselectOptions',
  'paste',
  'keyboard',
];

function _patchAction(userEvent: any, action: Action): void {
  fill(userEvent, action, function (orig: () => void | Promise<unknown>) {
    return function patchedAction(this: unknown, ...args: unknown[]) {
      const span = Sentry.startInactiveSpan({
        op: 'user event',
        name: action,
        onlyIfParent: true,
      });

      const maybePromise = orig.call(this, ...args);

      if (isThenable(maybePromise)) {
        return maybePromise.then((res: unknown) => {
          span.end();
          return res;
        });
      }

      span.end();
      return maybePromise;
    };
  });
}
