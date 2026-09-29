# Seer Markdown Embeds

Embeds render inside host surfaces such as Seer conversations. Keep widget actions and
interaction state local to the embed so an interaction cannot change the host page URL,
navigation history, or shareable state.

- Do not pass the host router's `location` or `navigate` into embedded widgets.
- Store legend selections, sorts, column sizes, and similar UI state inside the embed.
- Disable widget actions that the embed does not handle locally.
- Explicit resource links may navigate away from the embed.

For dashboard widget legends, use `useLocalWidgetLegendSelectionState` instead of
`WidgetLegendSelectionState`. When introducing a new interactive widget embed, add coverage
that verifies its interaction state stays local to the embed.

## Block chrome

Every block-level embed renders inside `SeerEmbedBlock` (`components/seerEmbedBlock.tsx`).
It is the only place that draws the card: a header band carrying the resource's name and a
collapse toggle on the left, a `View <resource>` link on the right, and the embed's own
preview in a collapsible panel below.

- Pass the resource's name as `title` and a fixed call to action as `linkLabel`
  (`View Dashboard`, `View Query`). The name is the toggle's label, not a link -- clicking
  the title must not navigate out of the conversation.
- A block with no page of its own -- a `chart` drawn from data in the answer -- passes
  `href`, `icon` and `linkLabel` as a group or not at all, and gets a header with the
  toggle alone. The three cannot be split: a label with nowhere to go is not a link.
- Query embeds go through `QueryEmbedCard`, which is `SeerEmbedBlock` plus the formatted
  query row.
- Do not draw a bordered `Container` around a block yourself. A block that needs its own
  chrome is a signal that `SeerEmbedBlock` is missing a slot.
- Judge `defaultExpanded` per embed. Collapsing does not defer the work -- the panel uses
  `hidden="until-found"`, so its contents stay mounted -- so it buys vertical space, not
  load time. A preview that is the point of the message (a chart, a waterfall, a single
  issue row) opens expanded; something long enough to bury the reply should not.
- The inline `*Link` components are unchanged: they still render the resource's name as the
  link, because inline there is no header to separate the two. Where a block needs the same
  href or title, export a `get<X>Href` / `get<X>Title` helper from the link file and use it
  from both so the two levels cannot drift.

### What is not a block

The rule covers previews. An embed whose block output is _only_ a link or a single control
has nothing to put in a panel, and wrapping it would give the reader a card whose entire
contents are the link already sitting in its header. These render bare, by design:

| Embed                | Block output    | Why no card                                                                               |
| -------------------- | --------------- | ----------------------------------------------------------------------------------------- |
| `trace`              | compact link    | declared `level: ['inline']`; the waterfall is the separate `traceWaterfall` embed        |
| `docs`               | compact link    | declared `level: ['inline']`; a docs URL has no preview                                   |
| `dsn`                | `TextCopyInput` | one copyable value, and no page in Sentry to link to                                      |
| `replay` (no clip)   | compact link    | falls back to a link when there is no event timestamp, or the reader has no replay access |
| `agentWriteApproval` | action buttons  | an action to take, not a resource to preview -- see below                                 |

`agentWriteApproval` is deliberately left out of the rule for now: it asks the reader to
approve or reject a write, so a collapse toggle could hide a pending decision behind a
header. Whether it grows its own chrome is tracked separately from the block-chrome rule.

Anything else rendered at block level renders inside `SeerEmbedBlock`. Adding a new block
preview means adding a case to this section or routing it through the card -- there is no
third option.
