import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

export type CommandPaletteGroupKey = 'navigate' | 'add' | 'help';

interface CommonCommandPaletteAction {
  display: {
    /** Primary text shown to the user */
    label: string;
    /** Additional context or description */
    details?: string;
    /** Icon to render for this action */
    icon?: ReactNode;
  };
  /** Unique identifier for this action */
  key: string;
  /** Section to group the action in the palette */
  groupingKey?: CommandPaletteGroupKey;
  /** Whether this action should be hidden from the palette */
  hidden?: boolean;
  /** Optional keywords to improve searchability */
  keywords?: string[];
}

interface CommandPaletteActionLink extends CommonCommandPaletteAction {
  /** Navigate to a route when selected */
  to: LocationDescriptor;
  type: 'navigate';
}

interface CommandPaletteActionCallback extends CommonCommandPaletteAction {
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction: () => void;
  type: 'callback';
}

interface CommandPaletteActionGroup extends CommonCommandPaletteAction {
  /** Nested actions to show when this action is selected */
  actions: CommandPaletteAction[];
  type: 'group';
}

export type CommandPaletteAction =
  | CommandPaletteActionLink
  | CommandPaletteActionCallback
  | CommandPaletteActionGroup;
