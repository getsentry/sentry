export const BREADCRUMB_TYPE_LABELS = {
  start: 'Replay Start',
  feedback: 'User Feedback',
  replay: 'Replay',
  issue: 'Error',
  console: 'Console',
  nav: 'Navigation',
  pageLoad: 'Page Load',
  reload: 'Reload',
  navBackForward: 'Navigate Back/Forward',
  memory: 'Memory',
  paint: 'Paint',
  blur: 'User Blur',
  action: 'User Action',
  rageOrMulti: 'Rage & Multi Click',
  rageOrDead: 'Rage & Dead Click',
  hydrateError: 'Hydration Error',
  webVital: 'Web Vital',
  click: 'User Click',
  keydown: 'KeyDown',
  input: 'Input',
  tap: 'User Tap',
  swipe: 'User Swipe',
  scroll: 'User Scroll',
  device: 'Device',
  app: 'App',
  custom: 'Custom',
} as const satisfies Record<string, string>;

export type BreadcrumbType = keyof typeof BREADCRUMB_TYPE_LABELS;

export const BREADCRUMB_TYPES = Object.keys(BREADCRUMB_TYPE_LABELS) as BreadcrumbType[];
