import {useContext, useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';

import type {
  CMDKQueryOptions,
  CommandPaletteAction,
} from 'sentry/components/commandPalette/types';
import {
  CMDKEnclosingActionProvider,
  useCMDKChainedActionScope,
} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import type {CMDKChainedActionAnchor} from 'sentry/components/commandPalette/ui/cmdkChainedActionScope';
import {
  CommandPaletteSlot,
  useCommandPaletteSlotName,
} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import type {CommandPaletteSlotName} from 'sentry/components/commandPalette/ui/commandPaletteSlot';

import {makeCollection} from './collection';
import {
  CommandPaletteStateProvider,
  useCommandPaletteState,
} from './commandPaletteStateContext';

export interface CMDKResourceContext {
  /** 'selected' when the user has drilled into this action, otherwise undefined. */
  state: 'selected' | undefined;
}

interface DisplayProps {
  label: string;
  details?: string;
  icon?: React.ReactNode;
  labelSuffix?: React.ReactNode;
  trailingItem?: React.ReactNode;
}

export interface CMDKTextInput {
  /** Accessible label for the palette input while editing. */
  ariaLabel: string;
  /** Called with the raw input value when Enter is pressed. */
  onSubmit: (value: string) => void;
  /** Content displayed below the input while editing. */
  footer?: React.ReactNode;
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

export const CMDKCollection = makeCollection<CMDKActionData<any>>();

/**
 * Root provider for the command palette. Wrap the component tree that
 * contains CMDKAction registrations and the CommandPalette UI.
 */
export function CommandPaletteProvider({children}: {children: React.ReactNode}) {
  return (
    <CommandPaletteStateProvider>
      <CommandPaletteSlot.Provider>
        <CMDKCollection.Provider>{children}</CMDKCollection.Provider>
      </CommandPaletteSlot.Provider>
    </CommandPaletteStateProvider>
  );
}

interface CMDKActionRegistrationProps<TData = unknown> {
  display: DisplayProps;
  /** Semantic context represented by this row for the More Actions panel. */
  actionContext?: string;
  /** Exposes this action in the contextual More Actions panel. */
  actionPanel?: CMDKActionPanel;
  /** Focuses the first child when this action is opened. */
  autoFocusFirst?: boolean;
  children?: React.ReactNode | ((data: CommandPaletteAction[]) => React.ReactNode);
  /** Mounts static children only after this prompt action is selected. */
  deferChildren?: boolean;
  /** Keeps the action visible while preventing selection. */
  disabled?: boolean;
  /**
   * Stable reserved key for this node. Use the "cmdk:supplementary:" prefix to
   * guarantee the section always sorts last in search results regardless of score.
   * Example: id="cmdk:supplementary:help"
   */
  id?: string;
  /** Whether this action is currently included in its multi-select value. */
  isSelected?: boolean;
  keywords?: string[];
  /**
   * Maximum number of results to show. For async resources the default is 4;
   * for static children there is no limit unless this prop is set explicitly.
   */
  limit?: number;
  onAction?: () => void;
  onMultiSelect?: () => void;
  onNavigate?: () => void;
  onReorder?: (direction: 'up' | 'down') => void;
  /** Explicit sibling position for reorderable action lists. */
  order?: number;
  prompt?: string;
  resource?: (query: string, context: CMDKResourceContext) => CMDKQueryOptions<TData>;
  /** Opens another registered action by its stable `id`. */
  targetAction?: string;
  /** Turns this action into a free-text editor that submits on Enter. */
  textInput?: CMDKTextInput;
  to?: LocationDescriptor;
}

interface CMDKActionWithResourceProps<TData = unknown> {
  nodeKey: string;
  resourceOptions: CMDKQueryOptions<TData>;
  children?: React.ReactNode | ((data: CommandPaletteAction[]) => React.ReactNode);
}

function CMDKActionWithResource<TData = unknown>({
  nodeKey,
  resourceOptions,
  children,
}: CMDKActionWithResourceProps<TData>) {
  const {data} = useQuery({
    ...resourceOptions,
    enabled: resourceOptions.enabled ?? true,
  });

  // Render-prop: call function with async data (existing behavior).
  // Static children: render as-is. Resource results are auto-rendered alongside
  // static children so they register in the collection as depth-1 nodes
  // (no prefix injection in search results).
  const resolvedChildren =
    typeof children === 'function' ? (data ? children(data) : null) : (children ?? null);

  const resolvedResourceNodes =
    typeof children !== 'function' && data
      ? data.map((item, index) => <CMDKActionFromData key={index} action={item} />)
      : null;

  return (
    <CMDKCollection.Context.Provider value={nodeKey}>
      {resolvedChildren}
      {resolvedResourceNodes}
    </CMDKCollection.Context.Provider>
  );
}

function CMDKActionFromData({action}: {action: CommandPaletteAction}) {
  if ('actions' in action) {
    const {actions, ...props} = action;
    return (
      <CMDKAction.Group {...props}>
        {actions.map((child, index) => (
          <CMDKActionFromData key={index} action={child} />
        ))}
      </CMDKAction.Group>
    );
  }

  return 'to' in action ? (
    <CMDKAction.Link {...action} />
  ) : (
    <CMDKAction.Callback {...action} />
  );
}

/**
 * Registers a node in the collection. A node becomes a group when it has
 * children — they register under this node as their parent. Provide `to` for
 * navigation, `onAction` for a callback, or `resource` with a render-prop
 * children function to fetch and populate async results.
 */
function CMDKActionRegistration<TData = unknown>({
  actionContext,
  autoFocusFirst,
  deferChildren,
  disabled,
  display,
  keywords,
  children,
  id,
  isSelected,
  to,
  onAction,
  onMultiSelect,
  onNavigate,
  onReorder,
  order,
  prompt,
  resource,
  targetAction,
  textInput,
  limit,
  actionPanel,
}: CMDKActionRegistrationProps<TData>) {
  const slotName = useCommandPaletteSlotName();
  const parentKey = useContext(CMDKCollection.Context);
  const chainedActionScope = useCMDKChainedActionScope();

  // For async-only resource nodes (function children), default limit to 4.
  // For nodes with static children alongside a resource, no default limit applies.
  const effectiveLimit =
    limit ?? (resource && typeof children === 'function' ? 4 : undefined);

  const nodeData = useMemo<CMDKActionData<TData>>(
    () =>
      to === undefined
        ? onAction === undefined
          ? {
              actionContext,
              autoFocusFirst,
              disabled,
              display,
              keywords,
              resource,
              prompt,
              textInput,
              limit: effectiveLimit,
              actionPanel,
              order,
              slot: slotName ?? undefined,
              targetAction,
            }
          : {
              actionContext,
              autoFocusFirst,
              disabled,
              display,
              keywords,
              isSelected,
              onAction,
              onMultiSelect,
              onReorder,
              limit: effectiveLimit,
              actionPanel,
              order,
              chainedActionAnchor: chainedActionScope ?? undefined,
              slot: slotName ?? undefined,
              targetAction,
              textInput,
            }
        : {
            actionContext,
            autoFocusFirst,
            disabled,
            display,
            keywords,
            onNavigate,
            to,
            limit: effectiveLimit,
            actionPanel,
            order,
            slot: slotName ?? undefined,
            targetAction,
            textInput,
          },
    [
      actionContext,
      autoFocusFirst,
      chainedActionScope,
      disabled,
      display,
      effectiveLimit,
      keywords,
      isSelected,
      actionPanel,
      onAction,
      onMultiSelect,
      onNavigate,
      onReorder,
      order,
      prompt,
      resource,
      slotName,
      targetAction,
      textInput,
      to,
    ]
  );

  const key = CMDKCollection.useRegisterNode(nodeData, id);
  const {query, action: navAction} = useCommandPaletteState();
  let matchingNavAction = navAction;
  while (matchingNavAction && matchingNavAction.value.key !== key) {
    matchingNavAction = matchingNavAction.previous;
  }
  // Keep resource-backed ancestors mounted while navigating their descendants.
  // Otherwise selecting a child unmounts the resource that registered that child.
  const state = matchingNavAction ? 'selected' : undefined;
  const resourceQuery =
    navAction === null
      ? query
      : matchingNavAction
        ? navAction.value.key === key
          ? query
          : matchingNavAction.value.query
        : '';
  const shouldRenderChildren = deferChildren !== true || state === 'selected';

  const enclosingAction = useMemo(
    () => ({key, label: display.label, parentKey, prompt}),
    [display.label, key, parentKey, prompt]
  );

  if (!children && !resource && !textInput) {
    return null;
  }

  if (resource) {
    const resourceOptions = resource(resourceQuery ?? '', {state});

    // perf: an explicitly disabled resource still registers its action, but does not
    // need a disabled QueryObserver which can be expensive if registered for e.g. thousands of attributes
    if (resourceOptions.enabled === false || resourceOptions.queryFn === skipToken) {
      return (
        <CMDKCollection.Context.Provider value={key}>
          <CMDKEnclosingActionProvider value={enclosingAction}>
            {typeof children === 'function' || !shouldRenderChildren ? null : children}
          </CMDKEnclosingActionProvider>
        </CMDKCollection.Context.Provider>
      );
    }

    return (
      <CMDKEnclosingActionProvider value={enclosingAction}>
        <CMDKActionWithResource nodeKey={key} resourceOptions={resourceOptions}>
          {shouldRenderChildren ? children : null}
        </CMDKActionWithResource>
      </CMDKEnclosingActionProvider>
    );
  }

  return (
    <CMDKCollection.Context.Provider value={key}>
      <CMDKEnclosingActionProvider value={enclosingAction}>
        {typeof children === 'function' || !shouldRenderChildren ? null : children}
      </CMDKEnclosingActionProvider>
    </CMDKCollection.Context.Provider>
  );
}

type CommonActionProps = Pick<
  CMDKActionRegistrationProps,
  | 'actionContext'
  | 'actionPanel'
  | 'disabled'
  | 'display'
  | 'id'
  | 'keywords'
  | 'limit'
  | 'order'
>;

interface GroupActionProps extends CommonActionProps {
  children?: React.ReactNode;
  initialFocus?: 'search' | 'first-action';
  mount?: 'eager' | 'on-open';
  prompt?: string;
}

interface LinkActionProps extends CommonActionProps {
  to: LocationDescriptor;
  children?: React.ReactNode;
  onNavigate?: () => void;
}

interface CallbackActionProps extends CommonActionProps {
  onAction: () => void;
  children?: React.ReactNode;
  isSelected?: boolean;
  onMultiSelect?: () => void;
  onReorder?: (direction: 'up' | 'down') => void;
}

interface ResourceActionProps<TData = unknown> extends CommonActionProps {
  resource: (query: string, context: CMDKResourceContext) => CMDKQueryOptions<TData>;
  children?: React.ReactNode | ((data: CommandPaletteAction[]) => React.ReactNode);
  prompt?: string;
}

interface TextInputActionProps extends CommonActionProps {
  input: CMDKTextInput;
}

interface TargetActionProps extends CommonActionProps {
  target: string;
}

function GroupAction({initialFocus, mount, ...props}: GroupActionProps) {
  return (
    <CMDKActionRegistration
      {...props}
      autoFocusFirst={initialFocus === 'first-action'}
      deferChildren={mount === 'on-open'}
    />
  );
}

function LinkAction({onNavigate, ...props}: LinkActionProps) {
  return <CMDKActionRegistration {...props} onNavigate={onNavigate} />;
}

function CallbackAction(props: CallbackActionProps) {
  return <CMDKActionRegistration {...props} />;
}

function ResourceAction<TData = unknown>(props: ResourceActionProps<TData>) {
  return <CMDKActionRegistration {...props} />;
}

function TextInputAction({input, ...props}: TextInputActionProps) {
  return <CMDKActionRegistration {...props} textInput={input} />;
}

function TargetAction({target, ...props}: TargetActionProps) {
  return <CMDKActionRegistration {...props} targetAction={target} />;
}

/** Action variants make incompatible behaviors impossible to combine. */
export const CMDKAction = {
  Callback: CallbackAction,
  Group: GroupAction,
  Link: LinkAction,
  Resource: ResourceAction,
  Target: TargetAction,
  TextInput: TextInputAction,
};
