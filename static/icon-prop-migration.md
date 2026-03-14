# Icon Prop Migration

Icons should be passed via the `icon` prop on button components, not as JSX children.
Passing icons as children bypasses the padding-balance logic and icon sizing defaults.

## Why

`Button` (and `LinkButton`) accept an `icon` prop that:
- Automatically sizes the icon relative to the button size via `IconDefaultsProvider`
- Reduces left padding proportionally when an icon + label are present (visual balance)
- Renders the icon in the correct slot with the correct margin

Passing an icon as a JSX child skips all of this.

## How to migrate

### Icon-only button

```tsx
// ❌ Before
<Button aria-label="Add"><IconAdd /></Button>

// ✅ After
<Button icon={<IconAdd />} aria-label="Add" />
```

### Icon + label

```tsx
// ❌ Before — also remove any manual margin/padding styles on the icon
<Button><IconAdd style={{marginRight: space(1)}} />Create</Button>

// ✅ After
<Button icon={<IconAdd />}>Create</Button>
```

### LinkButton (same API as Button)

```tsx
// ❌ Before
<LinkButton to="/foo"><IconProfiling />Profile</LinkButton>

// ✅ After
<LinkButton icon={<IconProfiling />} to="/foo">Profile</LinkButton>
```

### Custom styled button wrappers (StyledButton, ToggleButton, etc.)

Check whether the wrapper already forwards the `icon` prop through to `Button` or
`LinkButton`. If it does, migrate the call site as above. If it does not, add the
`icon` prop to the wrapper's props and forward it.

```tsx
// StyledButton = styled(Button)`...` — already accepts ButtonProps, no wrapper change needed
<StyledButton icon={<IconChevron direction="down" />} />
```

### Custom wrappers without an `icon` prop (DownloadButton, ProductButtonInner, etc.)

Inspect each one. If it renders a single icon and nothing else, it may be
intentional — **mark `[s]`**. Otherwise add the `icon` prop to the wrapper.

---

## Todo list

Mark items `[x]` when done, `[s]` for intentional skips with a note.

Detection method: ast-grep `jsx_self_closing_element` with `^Icon` identifier,
`inside: { kind: jsx_element, stopBy: neighbor }` — matches only direct JSX children,
not prop values.

### Button

- [x] IconClose > Button (static/app/components/events/autofix/insights/autofixInsightCard.tsx:177:19)
- [x] IconClose > Button (static/app/components/events/autofix/insights/collapsibleChainLink.tsx:103:23)
- [x] IconAdd > Button (static/app/components/events/viewHierarchy/wireframe.tsx:334:13)
- [x] IconSubtract > Button (static/app/components/events/viewHierarchy/wireframe.tsx:337:13)
- [x] IconPanel > Button (static/app/views/profiling/profileSummary/index.tsx:581:9)
- [x] IconAdd > Button (static/app/views/explore/logs/tables/logsTableRow.tsx:616:9) — removed `style={{paddingRight: ...}}` from icon
- [x] IconJson > Button (static/app/views/explore/logs/tables/logsTableRow.tsx:684:11) — removed `style={{paddingRight: ...}}` from icon

### LinkButton

- [x] IconProfiling > LinkButton (static/app/views/insights/browser/webVitals/components/tables/pageSamplePerformanceTable.tsx:431:19)
- [x] IconPlay > LinkButton (static/app/views/insights/browser/webVitals/components/tables/pageSamplePerformanceTable.tsx:470:17)
- [x] IconProfiling > LinkButton (static/app/views/insights/common/components/samplesTable/spanSamplesTable.tsx:225:17)
- [x] IconProfiling > LinkButton (static/app/views/insights/mobile/screenload/components/tables/eventSamplesTable.tsx:110:17)

### StyledButton

- [x] IconSubtract > StyledButton (static/app/views/settings/organizationIntegrations/sentryAppDetailedView.tsx:353:15) — removed `style={{marginRight: ...}}` from icon
- [x] IconClose > StyledButton (static/gsApp/components/profiling/alerts.tsx:123:11)

### ToggleButton

- [s] IconChevron > ToggleButton (static/app/views/replays/detail/network/details/components.tsx:135:11) — `ToggleButton` is `styled('button')`, not `styled(Button)`; converting it would be a larger refactor with visual impact. Skip for now.

### Inspect — may be intentional

- [s] IconDownload > DownloadButton (static/app/components/profiling/exportProfileButton.tsx:40:7) — `size="zero"` variant intentionally uses children; the non-zero branch already uses `icon` prop correctly.
- [s] IconQuestion > ProductButtonInner (static/app/components/onboarding/productSelection.tsx:565:11) — trailing icon position is intentional; `ProductButtonInner` is a custom layout component, not a button wrapper.
