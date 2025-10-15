import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

export type CommandPaletteArea = {
  key: string;
  label: string;
};

export type CommandPaletteAction = {
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
  children?: CommandPaletteAction[];
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
  /** Section to group the action in the palette */
  section?: string;
  /** Navigate to a route when selected */
  to?: LocationDescriptor;
};

export type CommandPaletteStore = {
  /** All registered actions in order */
  actions: CommandPaletteAction[];
};

export type CommandPaletteConfig = {
  /** Register actions; existing keys will be replaced */
  registerActions: (actions: CommandPaletteAction[]) => void;
  /** Unregister actions by key */
  unregisterActions: (keys: string[]) => void;
};
