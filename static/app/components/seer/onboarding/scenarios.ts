import type {
  SeerOnboardingProject,
  SeerOnboardingRepo,
  SeerOnboardingState,
} from 'sentry/components/seer/onboarding/types';
import {t} from 'sentry/locale';

const REPOS: SeerOnboardingRepo[] = [
  {id: 'repo-1', name: 'acme/web'},
  {id: 'repo-2', name: 'acme/api'},
  {id: 'repo-3', name: 'acme/checkout-service'},
  {id: 'repo-4', name: 'acme/mobile'},
];

const PROJECTS: SeerOnboardingProject[] = [
  {id: 'project-1', slug: 'frontend'},
  {id: 'project-2', slug: 'backend'},
  {id: 'project-3', slug: 'mobile'},
];

/**
 * An organization that has cleared every gate: background triage runs and opens PRs.
 * Every other scenario is described as a diff against this.
 */
const CONFIGURED: SeerOnboardingState = {
  availableProjects: PROJECTS,
  availableRepos: REPOS,
  canWriteOrgSettings: true,
  enableSeerCoding: true,
  entitlement: 'seat-based',
  hasAutofixBudget: true,
  hasScmWriteAccess: true,
  hasSupportedScmIntegration: true,
  hideAiFeatures: false,
  isCodingSettingManaged: false,
  repoLinks: [
    {id: 'link-1', repoId: 'repo-1', projectId: 'project-1'},
    {id: 'link-2', repoId: 'repo-2', projectId: 'project-2'},
  ],
  stoppingPoints: {'project-1': 'create_pr', 'project-2': 'create_pr'},
};

/** Nothing wired up yet: no integration, no repositories, no automation. */
const NOTHING_SET_UP = {
  hasSupportedScmIntegration: false,
  repoLinks: [],
  stoppingPoints: {},
} satisfies Partial<SeerOnboardingState>;

export interface SeerOnboardingScenario {
  /** Why this scenario is worth looking at. */
  description: string;
  key: string;
  label: string;
  state: SeerOnboardingState;
}

/**
 * The onboarding states real users land in, in roughly the order they hit them.
 *
 * Shared between the onboarding lab and the modal's tests so both exercise the
 * same fixtures.
 */
export const SEER_ONBOARDING_SCENARIOS: SeerOnboardingScenario[] = [
  {
    key: 'brand-new',
    label: t('Brand new org (no Seer)'),
    description: t(
      'No Seer plan and nothing configured. Setup is not gated on billing, so they walk every step and Autofix starts the moment Seer is added.'
    ),
    state: {
      ...CONFIGURED,
      ...NOTHING_SET_UP,
      entitlement: 'none',
      hasAutofixBudget: false,
    },
  },
  {
    key: 'unpaid-configured',
    label: t('Set up, but no Seer plan'),
    description: t(
      'Every step finished ahead of buying. The modal should say Autofix is ready and waiting, and offer to add Seer.'
    ),
    state: {...CONFIGURED, entitlement: 'none', hasAutofixBudget: false},
  },
  {
    key: 'gen-ai-disabled',
    label: t('Seer on, generative AI disabled'),
    description: t(
      'Someone turned off AI features org-wide. This is the only case where the wizard shows a "Turn on generative AI" step — the option defaults to on, so it is an exception rather than a step.'
    ),
    state: {...CONFIGURED, ...NOTHING_SET_UP, hideAiFeatures: true},
  },
  {
    key: 'no-scm',
    label: t('No source code connected'),
    description: t('Seer is paid for but has never seen the code.'),
    state: {...CONFIGURED, ...NOTHING_SET_UP},
  },
  {
    key: 'scm-no-repos',
    label: t('GitHub connected, no repos linked'),
    description: t(
      'The integration is installed but no project has a repository attached, so Autofix has no context.'
    ),
    state: {...CONFIGURED, repoLinks: [], stoppingPoints: {}},
  },
  {
    key: 'half-linked',
    label: t('One repo linked, one row half-filled'),
    description: t(
      'A partially filled row should not count as linked, and should not block the rest of the form.'
    ),
    state: {
      ...CONFIGURED,
      repoLinks: [
        {id: 'link-1', repoId: 'repo-1', projectId: 'project-1'},
        {id: 'link-2', repoId: 'repo-3', projectId: ''},
      ],
      stoppingPoints: {'project-1': 'off'},
    },
  },
  {
    key: 'repos-automation-off',
    label: t('Repos linked, automation off'),
    description: t('Everything is wired up but nothing runs in the background.'),
    state: {
      ...CONFIGURED,
      stoppingPoints: {'project-1': 'off', 'project-2': 'off'},
    },
  },
  {
    key: 'stops-at-plan',
    label: t('Automation stops at Plan'),
    description: t('Triage runs in the background but never drafts a pull request.'),
    state: {
      ...CONFIGURED,
      stoppingPoints: {'project-1': 'plan', 'project-2': 'root_cause'},
    },
  },
  {
    key: 'coding-disabled',
    label: t('Code generation disabled'),
    description: t(
      'Projects are set to "create PR" but code generation is off, so no PR can be written.'
    ),
    state: {...CONFIGURED, enableSeerCoding: false},
  },
  {
    key: 'coding-managed',
    label: t('Code generation managed by org'),
    description: t('Code generation is force-disabled and the user cannot change it.'),
    state: {...CONFIGURED, enableSeerCoding: false, isCodingSettingManaged: true},
  },
  {
    key: 'read-only-member',
    label: t('Read-only member'),
    description: t(
      'AI is off and nothing is connected, but the viewer can only look — every control should be disabled and point at an admin.'
    ),
    state: {
      ...CONFIGURED,
      ...NOTHING_SET_UP,
      canWriteOrgSettings: false,
      hideAiFeatures: true,
    },
  },
  {
    key: 'no-scm-write-access',
    label: t('SCM app missing write access'),
    description: t(
      'Runs complete but pushing a branch fails. Not handled by the modal yet.'
    ),
    state: {...CONFIGURED, hasScmWriteAccess: false},
  },
  {
    key: 'no-budget',
    label: t('Out of Seer budget'),
    description: t(
      'Quota exhausted mid-month. Runs are paused but setup changes still stick.'
    ),
    state: {...CONFIGURED, hasAutofixBudget: false},
  },
  {
    key: 'fully-configured',
    label: t('Fully configured'),
    description: t('Nothing left to do. The modal should say so and get out of the way.'),
    state: CONFIGURED,
  },
];

export function getSeerOnboardingScenario(key: string): SeerOnboardingScenario {
  return (
    SEER_ONBOARDING_SCENARIOS.find(scenario => scenario.key === key) ??
    SEER_ONBOARDING_SCENARIOS[0]!
  );
}
