import type {AssertionAction} from 'sentry/utils/replays/assertions/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export default function actionToQuery(action: AssertionAction): null | string {
  switch (action.type) {
    case 'breadcrumb':
      if (action.category === 'ui.click') {
        return MutableSearch.fromQueryObject({
          ['click.selector']: action.matcher.dom_element.fullSelector,
        }).formatString();
      }
      if (action.category === 'navigation') {
        return `urls:${action.matcher.url}`;
      }
      return null;
    case 'span':
      return null;
    case 'timeout':
      return null;
    case 'null':
    default:
      return null;
  }
}
