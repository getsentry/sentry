import {TOP_BAR_HEIGHT_CSS_VAR} from 'sentry/views/navigation/constants';

export function scrollIntoViewBelowTopBar(element: HTMLElement, extraOffset = 0) {
  element.style.scrollMarginTop = `calc(var(${TOP_BAR_HEIGHT_CSS_VAR}, 0px) + ${extraOffset}px)`;
  element.scrollIntoView({behavior: 'smooth', block: 'start'});
}
