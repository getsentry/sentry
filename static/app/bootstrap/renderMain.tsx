import {ROOT_ELEMENT} from 'sentry/constants';
import {Main} from 'sentry/main';

import {renderDom} from './renderDom';

export function renderMain() {
  renderDom(Main, `#${ROOT_ELEMENT}`, {});
}
