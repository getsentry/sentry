import type {ReactNode} from 'react';
import type {LocationDescriptor} from 'history';

import type {CMDKQueryOptions} from 'sentry/components/commandPalette/types';
import type {CMDKChainedActionAnchor} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import type {CommandPaletteSlotName} from 'sentry/components/commandPalette/ui/commandPaletteSlot';

export interface CMDKResourceContext {
  /** 'selected' when the user has drilled into this action, otherwise undefined. */
  state: 'selected' | undefined;
}

export interface DisplayProps {
  label: string;
  details?: string;
  icon?: ReactNode;
  labelSuffix?: ReactNode;
  trailingItem?: ReactNode;
}

export interface CMDKTextInput {
  /** Accessible label for the palette input while editing. */
  ariaLabel: string;
  /** Called with the raw input value when Enter is pressed. */
  onSubmit: (value: string) => void;
  /** Content displayed below the input while editing. */
  footer?: ReactNode;
  /** Value placed in the palette input when the action is opened. */
  initialValue?: string;
}

export interface CMDKActionPanel {
  /** Selection context in which this action is available. Hierarchical contexts match descendants. */
  context: string;
  label: string;
  /** Runs a callback without changing the palette's current navigation step. */
  execution?: 'navigate' | 'preserve-view';
  order?: number;
  placement?: 'palette-and-panel' | 'panel-only';
}

interface CMDKActionDataBase {
  display: DisplayProps;
  /** Semantic context represented by this row for the More Actions panel. */
  actionContext?: string;
  actionPanel?: CMDKActionPanel;
  /** Focuses the first child when this action is opened. */
  autoFocusFirst?: boolean;
  disabled?: boolean;
  keywords?: string[];
  limit?: number;
  order?: number;
  slot?: CommandPaletteSlotName;
  /** Stable key of another action whose children this row opens. */
  targetAction?: string;
  textInput?: CMDKTextInput;
}

interface CMDKActionDataTo extends CMDKActionDataBase {
  to: LocationDescriptor;
  onNavigate?: () => void;
}

interface CMDKActionDataOnAction extends CMDKActionDataBase {
  onAction: () => void;
  chainedActionAnchor?: CMDKChainedActionAnchor;
  isSelected?: boolean;
  onMultiSelect?: () => void;
  onReorder?: (direction: 'up' | 'down') => void;
}

interface CMDKActionDataResource<TData = unknown> extends CMDKActionDataBase {
  prompt?: string;
  resource?: (query: string, context: CMDKResourceContext) => CMDKQueryOptions<TData>;
}

/**
 * Single data shape for all CMDK nodes. A node becomes a group by virtue of
 * having children registered under it — there is no separate group type.
 */
export type CMDKActionData<TData = unknown> =
  | CMDKActionDataTo
  | CMDKActionDataOnAction
  | CMDKActionDataResource<TData>;
