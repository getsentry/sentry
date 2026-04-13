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

interface DisplayProps {
  label: string;
  details?: string;
  icon?: React.ReactNode;
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
  resource?: (query: string) => CMDKQueryOptions;
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
  keywords?: string[];
  /**
   * Maximum number of results to show. For async resources the default is 4;
   * for static children there is no limit unless this prop is set explicitly.
   */
  limit?: number;
  onAction?: () => void;
  prompt?: string;
  resource?: (query: string) => CMDKQueryOptions;
  to?: LocationDescriptor;
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
  to,
  onAction,
  prompt,
  resource,
  limit,
}: CMDKActionProps) {
  const ref = CommandPaletteSlot.useSlotOutletRef();

  // For async resources, default to 4 when no explicit limit is given.
  // For static children, undefined means no limit.
  const effectiveLimit = limit ?? (resource ? 4 : undefined);

  const nodeData: CMDKActionData =
    to === undefined
      ? onAction === undefined
        ? {display, keywords, ref, resource, prompt, limit: effectiveLimit}
        : {display, keywords, ref, onAction, limit: effectiveLimit}
      : {display, keywords, ref, to, limit: effectiveLimit};

  const key = CMDKCollection.useRegisterNode(nodeData);
  const {query} = useCommandPaletteState();

  const resourceOptions = resource
    ? resource(query)
    : {queryKey: [] as unknown[], queryFn: () => null, enabled: false};

  const {data} = useQuery({
    ...resourceOptions,
    enabled: !!resource && (resourceOptions.enabled ?? true),
  });

  if (!children) {
    return null;
  }

  const resolvedChildren =
    typeof children === 'function' ? (data ? children(data) : null) : children;

  return (
    <CMDKCollection.Context.Provider value={key}>
      {resolvedChildren}
    </CMDKCollection.Context.Provider>
  );
}
