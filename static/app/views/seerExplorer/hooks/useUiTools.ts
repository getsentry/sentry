import {useCallback, useMemo} from 'react';
import {z} from 'zod';

import type {
  CMDKActionData,
  CMDKActionSchema,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CMDKCollection} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';

interface UiToolDefinition {
  description: string;
  key: string;
  name: string;
  param_schema: Record<PropertyKey, unknown>;
}

export interface ResolvedUiTool {
  component: React.ReactNode | null;
  execute: () => void;
}

function slugifyLabel(parts: string[]): string {
  return parts
    .join('_')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

function buildLabelPath(
  node: CollectionTreeNode<CMDKActionData>,
  nodeMap: Map<string, CollectionTreeNode<CMDKActionData>>
): string[] {
  const parts: string[] = [];
  let current: CollectionTreeNode<CMDKActionData> | undefined = node;
  while (current) {
    parts.unshift(current.display.label);
    current = current.parent ? nodeMap.get(current.parent) : undefined;
  }
  return parts;
}

function flattenTree(
  nodes: Array<CollectionTreeNode<CMDKActionData>>
): Array<CollectionTreeNode<CMDKActionData>> {
  const result: Array<CollectionTreeNode<CMDKActionData>> = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children.length > 0) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

function hasSchema(
  node: CollectionTreeNode<CMDKActionData>
): node is CollectionTreeNode<CMDKActionData> & {schema: CMDKActionSchema} {
  return node.schema !== undefined;
}

export function useUiTools(): {
  resolveUiTool: (
    key: string,
    args: Record<string, unknown>,
    name?: string
  ) => ResolvedUiTool | null;
  uiToolsJson: string | null;
} {
  const store = CMDKCollection.useStore();

  const {definitions, nodeMap, nameMap} = useMemo(() => {
    const tree = store.tree();
    const allNodes = flattenTree(tree);

    const keyMap = new Map<string, CollectionTreeNode<CMDKActionData>>();
    for (const node of allNodes) {
      keyMap.set(node.key, node);
    }

    const byName = new Map<string, CollectionTreeNode<CMDKActionData>>();
    const defs: UiToolDefinition[] = [];
    for (const node of allNodes) {
      if (!hasSchema(node)) {
        continue;
      }

      const labelPath = buildLabelPath(node, keyMap);
      const name = slugifyLabel(labelPath);
      let paramSchema: Record<PropertyKey, unknown> = {};
      try {
        const jsonSchema = z.toJSONSchema(node.schema.parameters);
        const {$schema: _, ...rest} = jsonSchema as Record<string, unknown>;
        paramSchema = rest;
      } catch {
        // Fall back to empty schema
      }

      byName.set(name, node);
      defs.push({
        name,
        description: node.schema.description,
        key: node.key,
        param_schema: paramSchema,
      });
    }

    return {definitions: defs, nodeMap: keyMap, nameMap: byName};
  }, [store]);

  const uiToolsJson = useMemo(() => {
    if (definitions.length === 0) {
      return null;
    }
    return JSON.stringify(definitions);
  }, [definitions]);

  const resolveUiTool = useCallback(
    (
      key: string,
      args: Record<string, unknown>,
      name?: string
    ): ResolvedUiTool | null => {
      const node = nodeMap.get(key) ?? (name ? nameMap.get(name) : undefined);
      if (!node || !hasSchema(node)) {
        return null;
      }

      const result = node.schema.parameters.safeParse(args);
      if (!result.success) {
        return null;
      }

      const parsedArgs = result.data as Record<string, unknown>;
      return {
        component: node.schema.component?.(parsedArgs) ?? null,
        execute: () => node.schema.onExecute(parsedArgs),
      };
    },
    [nodeMap, nameMap]
  );

  return {uiToolsJson, resolveUiTool};
}
