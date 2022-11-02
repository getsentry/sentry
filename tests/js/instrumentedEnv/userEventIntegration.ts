import {Hub} from '@sentry/core';
import {fill, isThenable, loadModule} from '@sentry/utils';

export function instrumentUserEvent(getCurrentHub: () => Hub): void {
  const pkg = loadModule('@testing-library/user-event') as any;
  ACTIONS.forEach((action: Action) => _patchAction(pkg.default, action, getCurrentHub));
}

type Action = typeof ACTIONS[number];

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

function _patchAction(userEvent: any, action: Action, getCurrentHub?: () => Hub): void {
  fill(userEvent, action, function (orig: () => void | Promise<unknown>) {
    return function patchedAction(this: unknown, ...args: unknown[]) {
      const scope = getCurrentHub?.().getScope();
      const parentSpan = scope?.getSpan();
      const span = parentSpan?.startChild({
        op: 'user event',
        description: action,
      });

      const maybePromise = orig.call(this, ...args);

      if (isThenable(maybePromise)) {
        return maybePromise.then((res: unknown) => {
          span?.finish();
          return res;
        });
      }

      span?.finish();
      return maybePromise;
    };
  });
}
