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
- Query embeds go through `QueryEmbedCard`, which is `SeerEmbedBlock` plus the formatted
  query row.
- Do not draw a bordered `Container` around a block yourself. A block that needs its own
  chrome is a signal that `SeerEmbedBlock` is missing a slot.
- The inline `*Link` components are unchanged: they still render the resource's name as the
  link, because inline there is no header to separate the two. Where a block needs the same
  href or title, export a `get<X>Href` / `get<X>Title` helper from the link file and use it
  from both so the two levels cannot drift.
