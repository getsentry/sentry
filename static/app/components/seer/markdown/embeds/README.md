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
