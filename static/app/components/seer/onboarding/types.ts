import type {UserFacingStoppingPoint} from 'sentry/utils/seer/types';

export interface SeerOnboardingRepo {
  id: string;
  /** Display name, in `owner/name` form. */
  name: string;
}

export interface SeerOnboardingProject {
  id: string;
  slug: string;
}

/**
 * One repository attached to one project. Mirrors a `SeerProjectRepository` row,
 * which is what Autofix actually reads — code mappings are only suggestions.
 */
export interface SeerRepoLink {
  id: string;
  /** Empty until the row is filled in. */
  projectId: string;
  repoId: string;
}

/**
 * Everything the Seer onboarding modal needs to know, flattened into plain data.
 *
 * The modal is intentionally presentational: it never queries or mutates. Production
 * callsites derive this from the API (`seer/onboarding-check/`, `seer/setup-check/`,
 * `/organizations/{org}/repos/`, project settings, ...) while the onboarding lab hands
 * it fabricated values, so every scenario is reachable without touching a real
 * organization.
 */
export interface SeerOnboardingState {
  /** Projects the user could attach a repository to. */
  availableProjects: SeerOnboardingProject[];
  /** Repositories visible through the connected SCM integration. */
  availableRepos: SeerOnboardingRepo[];
  /** `org:write` — required to change any of the settings below. */
  canWriteOrgSettings: boolean;
  /** Org option `sentry:enable_seer_coding`. Without it Seer never writes code. */
  enableSeerCoding: boolean;
  /** Which Seer plan the org is on, if any. */
  entitlement: 'none' | 'legacy' | 'seat-based';
  /** Whether the org has `SEER_AUTOFIX` / `SEER_SCANNER` budget left. */
  hasAutofixBudget: boolean;
  /** Whether the SCM app still has write permission — PRs fail without it. */
  hasScmWriteAccess: boolean;
  /** An active GitHub, GitHub Enterprise or (flagged) GitLab integration. */
  hasSupportedScmIntegration: boolean;
  /** Org option `sentry:hide_ai_features`. */
  hideAiFeatures: boolean;
  /** `organizations:seer-disable-coding-setting` — code generation is org-managed. */
  isCodingSettingManaged: boolean;
  /** Repository/project pairings, one row per pairing. */
  repoLinks: SeerRepoLink[];
  /**
   * Where automated runs stop, per project. Only `create_pr` produces a pull
   * request. Projects missing from this map have never been configured.
   */
  stoppingPoints: Record<string, UserFacingStoppingPoint>;
}

/**
 * The writes the modal can ask for. Production supplies real mutations; the
 * onboarding lab supplies simulated ones that mutate local state.
 */
export interface SeerOnboardingActions {
  /** Send the user off to buy or trial Seer. Setup itself never waits on this. */
  activateSeer(): void;
  /** Start a new, empty repository/project row. */
  addRepoLink(): void;
  connectScm(): void;
  enableAiFeatures(): void;
  removeRepoLink(linkId: string): void;
  setEnableSeerCoding(value: boolean): void;
  setLinkProject(linkId: string, projectId: string): void;
  setLinkRepo(linkId: string, repoId: string): void;
  setProjectStoppingPoint(projectId: string, value: UserFacingStoppingPoint): void;
}

/** Projects that have at least one repository attached. */
export function getLinkedProjects(state: SeerOnboardingState): SeerOnboardingProject[] {
  const linkedIds = new Set(
    state.repoLinks.filter(link => link.projectId && link.repoId).map(l => l.projectId)
  );
  return state.availableProjects.filter(project => linkedIds.has(project.id));
}

/**
 * Autofix needs at least one project that is wired end to end: a repository to
 * work in, permission to write code, and an automated run that goes as far as
 * opening the pull request.
 */
export function willOpenPullRequests(state: SeerOnboardingState): boolean {
  return (
    state.enableSeerCoding &&
    getLinkedProjects(state).some(
      project => state.stoppingPoints[project.id] === 'create_pr'
    )
  );
}
