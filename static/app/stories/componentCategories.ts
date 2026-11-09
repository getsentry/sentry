interface ComponentCategoryConfig {
  label: string;
  subgroups?: ReadonlyArray<{
    components: readonly string[];
    label: string;
  }>;
}

const componentCategoryConfig = {
  layout: {label: 'Layout'},
  typography: {label: 'Typography'},
  buttons: {label: 'Buttons'},
  controls: {label: 'Controls'},
  forms: {
    label: 'Forms',
    subgroups: [
      {
        label: 'Primitives',
        components: [
          'input',
          'inputgroup',
          'numberinput',
          'numberdraginput',
          'otpinput',
          'checkbox',
          'radio',
          'switch',
          'slider',
          'select',
        ],
      },
    ],
  },
  navigation: {label: 'Navigation'},
  feedback: {label: 'Feedback'},
  status: {label: 'Status'},
  display: {label: 'Display'},
  chat: {label: 'AI & Chat'},
  overlays: {label: 'Overlays'},
} as const satisfies Record<string, ComponentCategoryConfig>;

export type ComponentCategory = keyof typeof componentCategoryConfig;

export const COMPONENT_CATEGORY_CONFIG: Record<
  ComponentCategory,
  ComponentCategoryConfig
> = componentCategoryConfig;

export const COMPONENT_CATEGORY_ORDER = Object.keys(
  COMPONENT_CATEGORY_CONFIG
) as ComponentCategory[];

export function isComponentCategory(value: unknown): value is ComponentCategory {
  return typeof value === 'string' && Object.hasOwn(COMPONENT_CATEGORY_CONFIG, value);
}

/**
 * Story files are keyed by their path relative to `static/`. Scraps docs live
 * next to their components in the package, while core components that have not
 * moved yet, and the overview, pattern, and principle pages, live in the app.
 */
const APP_CORE_PREFIX = 'app/components/core/';
const SCRAPS_STORY_PREFIX = 'packages/scraps/src/';
const CORE_DOCUMENTATION_PREFIXES = [
  `${APP_CORE_PREFIX}overview/`,
  `${APP_CORE_PREFIX}patterns/`,
  `${APP_CORE_PREFIX}principles/`,
];

export function isScrapsStoryFile(file: string) {
  return file.startsWith(SCRAPS_STORY_PREFIX);
}

export function validateComponentCategory(file: string, value: unknown) {
  const isCoreComponentDoc =
    isScrapsStoryFile(file) ||
    (file.startsWith(APP_CORE_PREFIX) &&
      !CORE_DOCUMENTATION_PREFIXES.some(prefix => file.startsWith(prefix)));

  if (isCoreComponentDoc && !isComponentCategory(value)) {
    throw new Error(
      `${file} has an invalid component category ${JSON.stringify(value)}. ` +
        `Expected one of: ${COMPONENT_CATEGORY_ORDER.join(', ')}`
    );
  }
}
