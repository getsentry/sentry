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

const CORE_COMPONENT_PREFIX = 'components/core/';
const CORE_DOCUMENTATION_PREFIXES = [
  `${CORE_COMPONENT_PREFIX}overview/`,
  `${CORE_COMPONENT_PREFIX}patterns/`,
  `${CORE_COMPONENT_PREFIX}principles/`,
];

export function validateComponentCategory(file: string, value: unknown) {
  const isCoreComponentDoc =
    file.startsWith(CORE_COMPONENT_PREFIX) &&
    !CORE_DOCUMENTATION_PREFIXES.some(prefix => file.startsWith(prefix));

  if (isCoreComponentDoc && !isComponentCategory(value)) {
    throw new Error(
      `${file} has an invalid component category ${JSON.stringify(value)}. ` +
        `Expected one of: ${COMPONENT_CATEGORY_ORDER.join(', ')}`
    );
  }
}
