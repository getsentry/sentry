# UI Tools Frontend Plan

Progressive integration of CMDK actions with Seer explorer. Only actions that opt in via a `schema` are forwarded to Seer.

## Design

### Opt-in via schema

CMDK actions can declare an optional `schema` prop. It serves two purposes:

1. **Opt-in signal** — only actions with a schema are serialized and sent to Seer
2. **Response validation** — Seer's returned arguments are validated against the Zod schema before execution

```typescript
// Navigation action, no parameters
schema: {
  description: 'Navigate to the Legal & Compliance settings page.',
  parameters: z.object({}),
}

// Action with parameters
schema: {
  description: 'Filter the issues list by a specific tag.',
  parameters: z.object({
    tag: z.string().describe('The tag key to filter by'),
    value: z.string().describe('The tag value'),
  }),
}
```

### Serialization

`z.toJSONSchema(schema.parameters)` converts the Zod schema to standard JSON Schema for Seer's `json_schema_to_tool_params()`.

### Flow

```
CMDKAction (with schema)
  → useUiTools()             collect schema-bearing actions from CMDK tree
  → z.toJSONSchema()         convert Zod → JSON Schema
  → useSeerExplorer          send as ui_tools JSON string in chat request
  → Seer                     registers as FunctionTools, LLM picks by name
  → tool_links metadata      { ui_tool: true, key: "ui-abc123", tool_name: "...", arguments: {...} }
  → useUiTools.execute()     look up by key, safeParse arguments, invoke action
```

---

## TODO

### 1. Add `schema` prop to CMDK action types

**File: `static/app/components/commandPalette/ui/cmdk.tsx`**

- [ ] Add optional `schema` to `CMDKActionDataBase` (line ~25):
  ```typescript
  schema?: {
    description: string;
    parameters: z.ZodType;
  };
  ```
- [ ] Add `schema` to `CMDKActionProps` (line ~70)
- [ ] Include `schema` in `nodeData` construction (line ~161-166)

### 2. Annotate Legal & Compliance action with schema

**File: `static/gsApp/components/gsBillingCommandPaletteActions.tsx`**

- [ ] Import `z` from `zod`
- [ ] Add `schema` prop to the Legal & Compliance `CMDKAction` (line ~73):
  ```tsx
  <CMDKAction
    display={{label: t('Legal & Compliance'), icon: <IconDocs />}}
    keywords={['terms', 'privacy', 'gdpr', 'dpa', 'tos', 'ccpa', 'soc2']}
    to={`${prefix}/legal/`}
    schema={{
      description: 'Navigate to the Legal & Compliance settings page.',
      parameters: z.object({}),
    }}
  />
  ```

### 3. Create `useUiTools` hook

**New file: `static/app/views/seerExplorer/hooks/useUiTools.ts`**

Collects schema-bearing CMDK actions, serializes them for Seer, and provides an executor.

- [ ] Walk the CMDK collection tree (`CMDKCollection.useStore().tree()`)
- [ ] Filter to nodes that have `schema` set
- [ ] For each, build a `UiToolDefinition`:
  - `name`: slugified from label path (e.g. `navigate_to_legal_compliance`)
  - `description`: from `schema.description`
  - `key`: deterministic CMDK key (same hash used by collection)
  - `param_schema`: `z.toJSONSchema(schema.parameters)` (strip `$schema` wrapper)
- [ ] Memoize and JSON-encode as `uiToolsJson: string | null` (null if empty)
- [ ] Implement `executeUiTool(key: string, args: Record<string, unknown>)`:
  1. Find CMDK node by key in the tree
  2. If not found → return `{ executed: false, error: 'Action no longer available' }`
  3. Validate args via `schema.parameters.safeParse(args)`
  4. If invalid → return `{ executed: false, error: parse error message }`
  5. If navigation (`to` in node) → `navigate(to)`, return `{ executed: true }`
  6. If callback (`onAction` in node) → `node.onAction()`, return `{ executed: true }`

Key helper functions to extract from the existing deleted `useUiActions.ts` pattern:

- `generateDeterministicKey(source, labelPath, type, url?)` — hash-based key
- `slugifyLabel(labelPath)` — convert "Go to > Legal & Compliance" to `navigate_to_legal_compliance`

### 4. Send `ui_tools` in chat request

**File: `static/app/views/seerExplorer/hooks/useSeerExplorer.tsx`**

- [ ] Add `uiToolsJson?: string | null` to the `sendMessage` callback params
- [ ] In `sendMessageMutate` params type (line ~155), add `uiTools: string | null`
- [ ] In `mutationFn` request data (line ~174), add `ui_tools: params.uiTools` (only when non-null)
- [ ] In `sendMessage` callback (line ~432), pass `uiTools: uiToolsJson` through to `sendMessageMutate`

### 5. Wire `useUiTools` into the drawer

**File: `static/app/views/seerExplorer/components/drawer/explorerDrawerContent.tsx`**

- [ ] Call `useUiTools()` to get `{ uiToolsJson, executeUiTool }`
- [ ] Pass `uiToolsJson` to `useSeerExplorer` (or directly to `sendMessage`)

### 6. Handle UI tool responses

**File: `static/app/views/seerExplorer/utils.tsx`**

- [ ] In `getToolsStringFromBlock()` (line ~407), add a branch for UI tools:
  - Check if `toolLink?.params?.ui_tool === true`
  - If so, format as `"Navigated to {tool_name}"` (or loading variant)
  - Don't fall through to the generic `"Used {tool.function} tool"` message

**File: `static/app/views/seerExplorer/components/blockComponents.tsx`**

- [ ] When rendering tool calls, detect `ui_tool: true` in tool_links params
- [ ] Call `executeUiTool(params.key, params.arguments)` to invoke the action
- [ ] This needs `executeUiTool` threaded through from the drawer (via context or prop)

### 7. Tests

- [ ] Test `useUiTools` serialization: schema-bearing actions produce correct `UiToolDefinition[]`
- [ ] Test `useUiTools` filtering: actions without `schema` are excluded
- [ ] Test `executeUiTool` validation: invalid args rejected, valid args execute
- [ ] Test `executeUiTool` stale key: returns error when action no longer exists

---

## Key type definitions

```typescript
// On CMDKActionDataBase (cmdk.tsx)
schema?: {
  description: string;
  parameters: z.ZodType;
};

// Serialized to Seer (matches Seer's UiToolDefinition)
interface UiToolDefinition {
  name: string;         // slugified label
  description: string;  // from schema.description
  key: string;          // deterministic CMDK key
  param_schema: object; // z.toJSONSchema(schema.parameters)
}

// tool_links metadata from Seer response
interface UiToolLinkParams {
  ui_tool: true;
  tool_name: string;
  key: string;          // CMDK key for lookup
  arguments: Record<string, unknown>;
}
```

## Out of scope (for now)

- Callback actions with parameters (only navigation for the first pass)
- Filtering actions by page context (send all schema-bearing actions)
- User approval step for callback actions (auto-execute navigation, add approval later)
