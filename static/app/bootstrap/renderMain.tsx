import ReactDOM from 'react-dom';

import {ROOT_ELEMENT} from 'app/constants';
import Main from 'app/main';

export function renderMain() {
  const rootEl = document.getElementById(ROOT_ELEMENT);

  try {
    ReactDOM.render(<Main />, rootEl);
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
