import {fill, isThenable} from '@sentry/core';
import * as Sentry from '@sentry/react';
import {userEvent} from '@testing-library/user-event'; // eslint-disable-line no-restricted-imports

export function instrumentUserEvent(): void {
  ACTIONS.forEach((action: Action) => _patchAction(userEvent, action));
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

function _patchAction(target: any, action: Action): void {
  fill(target, action, (orig: () => void | Promise<unknown>) => {
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
