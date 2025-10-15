import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

export type CommandPaletteAction = {
  /** Unique identifier for this action */
  key: string;
  /** Primary text shown to the user */
  label: string;
  /** Icon to render for this action */
  actionIcon?: ReactNode;
  /** Nested actions to show when this action is selected */
  children?: CommandPaletteAction[];
  /** Additional context or description */
  details?: string;
  /** Whether this action should be hidden from results */
  hidden?: boolean;
  /** Whether this action should keep the modal open after execution */
  keepOpen?: boolean;
  /** Optional keywords to improve searchability */
  keywords?: string[];
  /**
   * Execute a callback when the action is selected.
   * Use the `to` prop if you want to navigate to a route.
   */
  onAction?: () => void;
  /** Section to group the action in the palette */
  section?: string;
  /** Navigate to a route when selected */
  to?: LocationDescriptor;
};
