import {useQuery} from '@tanstack/react-query';
import type {LocationDescriptor} from 'history';

import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import type {CMDKQueryOptions} from 'sentry/components/commandPalette/types';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';

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
  trailingItem?: React.ReactNode;
}

interface CMDKActionDataBase {
  display: DisplayProps;
  keywords?: string[];
  limit?: number;
  ref?: React.RefObject<HTMLElement | null>;
}

interface CMDKActionDataTo extends CMDKActionDataBase {
  to: LocationDescriptor;
}

interface CMDKActionDataOnAction extends CMDKActionDataBase {
  onAction: () => void;
}

interface CMDKActionDataResource extends CMDKActionDataBase {
  prompt?: string;
  resource?: (query: string, context: CMDKResourceContext) => CMDKQueryOptions;
}

/**
 * Single data shape for all CMDK nodes. A node becomes a group by virtue of
 * having children registered under it — there is no separate group type.
 */
export type CMDKActionData =
  | CMDKActionDataTo
  | CMDKActionDataOnAction
  | CMDKActionDataResource;

export const CMDKCollection = makeCollection<CMDKActionData>();

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

interface CMDKActionProps {
  display: DisplayProps;
  children?: React.ReactNode | ((data: CommandPaletteAction[]) => React.ReactNode);
  /**
   * Stable reserved key for this node. Use the "cmdk:supplementary:" prefix to
   * guarantee the section always sorts last in search results regardless of score.
   * Example: id="cmdk:supplementary:help"
   */
  id?: string;
  keywords?: string[];
  /**
   * Maximum number of results to show. For async resources the default is 4;
   * for static children there is no limit unless this prop is set explicitly.
   */
  limit?: number;
  onAction?: () => void;
  prompt?: string;
  resource?: (query: string, context: CMDKResourceContext) => CMDKQueryOptions;
  to?: LocationDescriptor;
}

interface CMDKActionWithResourceProps {
  nodeKey: string;
  query: string;
  resource: (query: string, context: CMDKResourceContext) => CMDKQueryOptions;
  state: 'selected' | undefined;
  children?: React.ReactNode | ((data: CommandPaletteAction[]) => React.ReactNode);
}

function CMDKActionWithResource({
  nodeKey,
  query,
  state,
  resource,
  children,
}: CMDKActionWithResourceProps) {
  const resourceOptions = resource(query, {state});
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
      ? data.map((item, i) => {
          // CommandPaletteActionGroup has an `actions` prop that CMDKAction doesn't
          // accept, so we skip groups here — they can't be auto-rendered as leaf nodes.
          if ('actions' in item) return null;
          return <CMDKAction key={i} {...item} />;
        })
      : null;

  return (
    <CMDKCollection.Context.Provider value={nodeKey}>
      {resolvedChildren}
      {resolvedResourceNodes}
    </CMDKCollection.Context.Provider>
  );
}

/**
 * Registers a node in the collection. A node becomes a group when it has
 * children — they register under this node as their parent. Provide `to` for
 * navigation, `onAction` for a callback, or `resource` with a render-prop
 * children function to fetch and populate async results.
 */
export function CMDKAction({
  display,
  keywords,
  children,
  id,
  to,
  onAction,
  prompt,
  resource,
  limit,
}: CMDKActionProps) {
  const ref = CommandPaletteSlot.useSlotOutletRef();

  // For async-only resource nodes (function children), default limit to 4.
  // For nodes with static children alongside a resource, no default limit applies.
  const effectiveLimit =
    limit ?? (resource && typeof children === 'function' ? 4 : undefined);

  const nodeData: CMDKActionData =
    to === undefined
      ? onAction === undefined
        ? {display, keywords, ref, resource, prompt, limit: effectiveLimit}
        : {display, keywords, ref, onAction, limit: effectiveLimit}
      : {display, keywords, ref, to, limit: effectiveLimit};

  const key = CMDKCollection.useRegisterNode(nodeData, id);
  const {query, action: navAction} = useCommandPaletteState();
  const state = navAction?.value.key === key ? 'selected' : undefined;

  if (!children && !resource) {
    return null;
  }

  if (resource) {
    return (
      <CMDKActionWithResource
        nodeKey={key}
        query={query}
        state={state}
        resource={resource}
      >
        {children}
      </CMDKActionWithResource>
    );
  }

  return (
    <CMDKCollection.Context.Provider value={key}>
      {typeof children === 'function' ? null : children}
    </CMDKCollection.Context.Provider>
  );
}
