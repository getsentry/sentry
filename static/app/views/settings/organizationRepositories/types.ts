import type {ButtonProps} from '@sentry/scraps/button';

import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import type {OrganizationIntegration, Repository} from 'sentry/types/integrations';
import type {Fuse} from 'sentry/utils/fuzzySearch';

/**
 * Fuse match results keyed by `repository.id`, used to highlight the matched
 * portions of repository names in the table.
 */
export type ScmRepoMatches = Record<string, readonly Fuse.FuseResultMatch[]>;

export interface ScmInstallation {
  /**
   * The installed integration this row represents.
   */
  integration: OrganizationIntegration;
  /**
   * Repositories under this installation. Empty arrays render an empty-state
   * message in place of the row list.
   */
  repositories: Repository[];
  /**
   * When true, the installation header is rendered as a non-toggleable row
   * (can't be expanded). Use for disabled/inactive integrations whose
   * repos shouldn't be exposed.
   */
  expandDisabled?: boolean;
  /**
   * Whether the installation should start expanded. Single-installation
   * tables auto-expand regardless of this flag.
   */
  initiallyExpanded?: boolean;
  /**
   * When true, the tag icon switches to a loading indicator and the tooltip
   * shows "Re-syncing in the background…" instead of the sync button.
   */
  isSyncing?: boolean;
  /**
   * Optional URL to the upstream provider's installation-management page
   * (e.g. GitHub's app settings). Surfaced as a "Manage repositories" link in
   * the empty state and the no-search-results state.
   */
  manageUrl?: string;
  /**
   * Project slugs keyed by `repository.id` for repos that have code mappings.
   * Each repo with one or more slugs renders a stack of project avatars on the
   * right of its row, with a hover tooltip identifying each project. When the
   * key is undefined, the right-side button + project list slot is hidden
   * entirely (use this when mapping data isn't available at all, vs. an empty
   * record which means "loaded, this repo has no mappings").
   */
  mappedProjectSlugsByRepoId?: Record<string, string[]>;
  /**
   * Whether code mappings are still being fetched. When true, rows that don't
   * yet have any mapped slugs render a `<Placeholder>` skeleton in place of
   * the project list, so users see an inline loading hint without blocking
   * the rest of the row.
   */
  mappingsLoading?: boolean;
  /**
   * Called when the user clicks the settings button. When omitted the button
   * is hidden.
   */
  onSettings?: () => void;
  /**
   * Called when the user clicks "Sync now" in the repository count tag
   * tooltip. When omitted the button is hidden.
   */
  onSync?: () => void;
  /**
   * Called when the user clicks the uninstall button. When omitted the button
   * is hidden.
   */
  onUninstall?: () => void;
  /**
   * Items rendered into the per-installation overflow (`...`) menu. When
   * omitted or empty, the menu trigger is hidden.
   */
  overflowMenuItems?: MenuItemProps[];
  /**
   * Renders an action element in the right slot of each repository row.
   * Only called when `mappedProjectSlugsByRepoId` is set on the installation.
   */
  repoActions?: (repo: Repository) => React.ReactNode;
  /**
   * Whether the parent is still fetching the repository list. Drives the
   * "Loading repositories" empty state and shows a loading indicator
   * alongside the repository count tag.
   */
  reposLoading?: boolean;
  /**
   * Props forwarded to the settings button. Use to disable or annotate it
   * while per-integration config is still being fetched.
   */
  settingsButtonProps?: Omit<ButtonProps, 'onClick'>;
  /**
   * Props forwarded to the uninstall button. Use to disable or annotate it
   * when the viewer lacks the required access.
   */
  uninstallButtonProps?: Omit<ButtonProps, 'onClick'>;
}
