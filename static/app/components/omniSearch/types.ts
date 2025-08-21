import type {ReactNode} from 'react';

export type OmniArea = {
  key: string;
  label: string;
  focused?: boolean;
};

export type OmniAction = {
  /** Logical area grouping for the action (e.g. navigate, issue, add) */
  areaKey: string;
  /** Unique identifier for this action */
  key: string;
  /** Primary text shown to the user */
  label: string;
  /** Keyboard shortcut (e.g. "cmd+k", "shift+r") */
  actionHotkey?: string;
  /** Icon to render for this action */
  actionIcon?: ReactNode;
  /** Action type grouping, useful for ordering (e.g. "navigate", "copy") */
  actionType?: string;
  /** Nested actions to show when this action is selected */
  children?: OmniAction[];
  /** Additional context or description */
  details?: string;
  /** Whether this action should be disabled */
  disabled?: boolean;
  /** Optional longer label or subtitle */
  fullLabel?: string;
  /** Whether this action should be hidden from results */
  hidden?: boolean;
  /** Whether this action should keep the modal open after execution */
  keepOpen?: boolean;
  /** Optional keywords to improve searchability */
  keywords?: string[];
  /** Execute an imperative action */
  onAction?: () => void;
  /** Numeric priority for result ordering; 0 = highest priority */
  priority?: number;
  /** Section to group the action in the palette */
  section?: string;
  /** Navigate to a route when selected */
  to?: string | Record<string, any>;
};

export type OmniSearchStore = {
  /** All registered actions in order */
  actions: OmniAction[];
  /** Priority order of areas, usually provided by focused contexts */
  areaPriority: string[];
  /** All registered areas keyed by area key */
  areasByKey: Map<string, OmniArea>;
  isSearchingSeer: boolean;
  setIsSearchingSeer: (isSearchingSeer: boolean) => void;
};

export type OmniSearchConfig = {
  /** Register actions; existing keys will be replaced */
  registerActions: (actions: OmniAction[]) => void;
  /** Update current priority list for areas */
  registerAreaPriority: (priority: string[]) => void;
  /** Register areas */
  registerAreas: (areas: OmniArea[]) => void;
  /** Unregister actions by key */
  unregisterActions: (keys: string[]) => void;
  /** Unregister areas by key */
  unregisterAreas: (keys: string[]) => void;
};
