import {ROOT_ELEMENT} from 'sentry/constants';
import Main from 'sentry/main';

import {renderDom} from './renderDom';

export function renderMain() {
  try {
    renderDom(Main, `#${ROOT_ELEMENT}`, {});
  } catch (err) {
    if (err.message === 'URI malformed') {
      // eslint-disable-next-line no-console
      console.error(
        new Error(
          'An unencoded "%" has appeared, it is super effective! (See https://github.com/ReactTraining/history/issues/505)'
        )
      );
      window.location.assign(window.location.pathname);
    }
  }
}
