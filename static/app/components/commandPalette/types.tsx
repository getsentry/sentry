import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

export type CommandPaletteGroupKey = 'navigate' | 'add' | 'help';

export type CommandPaletteAction = {
  /** Unique identifier for this action */
  key: string;
  /** Primary text shown to the user */
  label: string;
  /** Nested actions to show when this action is selected */
  actions?: CommandPaletteAction[];
  /** Additional context or description */
  details?: string;
  /** Section to group the action in the palette */
  groupingKey?: CommandPaletteGroupKey;
  /** Whether this action should be hidden from the palette */
  hidden?: boolean;
  /** Icon to render for this action */
  icon?: ReactNode;
  /** Optional keywords to improve searchability */
  keywords?: string[];
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction?: () => void;
  /** Navigate to a route when selected */
  to?: LocationDescriptor;
};
