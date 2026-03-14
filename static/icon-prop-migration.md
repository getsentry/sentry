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
// ❌ Before
<Button><IconAdd />Create</Button>

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
`icon` prop to the wrapper's props and forward it:

```tsx
// Before
const StyledButton = styled(Button)`...`;
<StyledButton><IconChevron direction="down" /></StyledButton>

// After — wrapper already accepts ButtonProps, no wrapper change needed
<StyledButton icon={<IconChevron direction="down" />} />
```

### Components with no `icon` prop (DeleteButton, FloatingCloseButton, etc.)

These are purpose-built icon-button wrappers. Inspect each one:
- If it renders a single icon and nothing else, it may be intentional — **skip**.
- If it is a general-purpose button that happens to lack the prop, add `icon` to its
  props and forward it to the underlying `Button`.

---

## Todo list

108 instances detected. Each line is `IconName > ParentComponent (file:line:col)`.

Mark items `[x]` when done. Skip items that are intentional (e.g. purpose-built
icon wrappers) by marking them `[s]` with a note.

### Button

- [ ] IconAdd > Button (static/app/components/events/viewHierarchy/wireframe.tsx:334:13)
- [ ] IconAdd > Button (static/app/components/teamSelector.tsx:286:21)
- [ ] IconAdd > Button (static/app/components/teamSelector.tsx:303:21)
- [ ] IconAdd > Button (static/app/views/dashboards/manage/index.tsx:650:35)
- [ ] IconAdd > Button (static/app/views/dashboards/manage/index.tsx:691:33)
- [ ] IconAdd > Button (static/app/views/explore/logs/tables/logsTableRow.tsx:616:9)
- [ ] IconAdd > Button (static/app/views/explore/multiQueryMode/content.tsx:204:17)
- [ ] IconAdd > Button (static/app/views/explore/tables/columnEditorModal.tsx:188:25)
- [ ] IconAdd > Button (static/app/views/settings/organizationIntegrations/integrationCodeMappings.tsx:282:23)
- [ ] IconAdd > Button (static/app/views/settings/organizationTeams/organizationTeams.tsx:60:13)
- [ ] IconArrow > Button (static/app/views/explore/logs/tables/logsInfiniteTable.tsx:792:7)
- [ ] IconArrow > Button (static/app/views/onboarding/onboarding.tsx:310:21)
- [ ] IconArrow > Button (static/app/views/relocation/relocation.tsx:244:17)
- [ ] IconBookmark > Button (static/app/views/discover/savedQuery/index.tsx:581:17)
- [ ] IconBookmark > Button (static/app/views/discover/savedQuery/index.tsx:608:15)
- [ ] IconBusiness > Button (static/gsApp/components/openInDiscoverBtn.tsx:30:13)
- [ ] IconChat > Button (static/app/components/events/autofix/autofixChanges.tsx:292:17)
- [ ] IconChat > Button (static/app/components/events/autofix/autofixRootCause.tsx:609:13)
- [ ] IconChat > Button (static/app/components/events/autofix/autofixSolution.tsx:558:13)
- [ ] IconChevron > Button (static/app/components/replays/replaySidebarToggleButton.tsx:16:13)
- [ ] IconChevron > Button (static/app/views/preprod/buildComparison/main/insights/insightDiffRow.tsx:105:19)
- [ ] IconChevron > Button (static/app/views/preprod/buildComparison/main/sizeCompareMainContent.tsx:323:17)
- [ ] IconChevron > Button (static/gsAdmin/components/customers/customerIntegrationDebugDetails.tsx:132:21)
- [ ] IconChevron > Button (static/gsApp/views/amCheckout/components/cart.tsx:949:21)
- [ ] IconChevron > Button (static/gsApp/views/amCheckout/components/cartDiff.tsx:578:17)
- [ ] IconChevron > Button (static/gsApp/views/subscriptionPage/usageHistory.tsx:241:19)
- [ ] IconClose > Button (static/app/components/events/autofix/insights/autofixInsightCard.tsx:177:19)
- [ ] IconClose > Button (static/app/components/events/autofix/insights/collapsibleChainLink.tsx:103:23)
- [ ] IconClose > Button (static/app/views/preprod/buildComparison/main/sizeCompareSelectedBuilds.tsx:126:21)
- [ ] IconClose > Button (static/app/views/preprod/buildDetails/main/buildDetailsMainContent.tsx:413:21)
- [ ] IconClose > Button (static/app/views/preprod/components/visualizations/appSizeTreemap.tsx:108:15)
- [ ] IconClose > Button (static/app/views/settings/organizationMembers/inviteRequestRow.tsx:106:17)
- [ ] IconCopy > Button (static/app/components/copyToClipboardButton.tsx:30:13)
- [ ] IconCopy > Button (static/app/components/events/autofix/autofixRootCause.tsx:244:13)
- [ ] IconCopy > Button (static/app/components/events/autofix/autofixSolution.tsx:331:13)
- [ ] IconCopy > Button (static/app/debug/notifications/previews/teamsPreview.tsx:48:19)
- [ ] IconCopy > Button (static/app/views/dashboards/controls.tsx:365:76)
- [ ] IconCopy > Button (static/app/views/replays/detail/header/replayDetailsPageBreadcrumbs.tsx:175:23)
- [ ] IconDelete > Button (static/app/components/forms/fields/projectMapperField.tsx:216:21)
- [ ] IconDelete > Button (static/app/views/settings/account/accountAuthorizations.tsx:111:27)
- [ ] IconDownload > Button (static/app/utils/discover/fieldRenderers.tsx:501:13)
- [ ] IconDownload > Button (static/app/views/dashboards/controls.tsx:268:25)
- [ ] IconEdit > Button (static/app/views/dashboards/controls.tsx:244:61)
- [ ] IconEdit > Button (static/app/views/settings/components/dataScrubbing/rules.tsx:36:23)
- [ ] IconEdit > Button (static/app/views/settings/dynamicSampling/organizationSampleRateInput.tsx:65:21)
- [ ] IconEllipsis > Button (static/app/views/discover/savedQuery/index.tsx:698:19)
- [ ] IconJson > Button (static/app/views/explore/logs/tables/logsTableRow.tsx:684:11)
- [ ] IconMail > Button (static/app/views/settings/organizationMembers/inviteBanner.tsx:261:21)
- [ ] IconPanel > Button (static/app/views/profiling/profileSummary/index.tsx:581:9)
- [ ] IconPlay > Button (static/app/views/issueDetails/groupReplays/groupReplays.tsx:321:15)
- [ ] IconRefresh > Button (static/app/components/events/autofix/autofixOutputStream.tsx:174:11)
- [ ] IconRefresh > Button (static/app/components/group/groupSummary.tsx:440:21)
- [ ] IconRefresh > Button (static/app/views/replays/detail/header/replayDetailsPageBreadcrumbs.tsx:188:21)
- [ ] IconSeer > Button (static/app/views/dashboards/manage/index.tsx:675:33)
- [ ] IconSettings > Button (static/app/components/group/assignedTo.tsx:287:21)
- [ ] IconSettings > Button (static/app/views/performance/transactionSummary/transactionThresholdButton.tsx:120:13)
- [ ] IconStar > Button (static/app/components/projects/bookmarkStar.tsx:61:9)
- [ ] IconStar > Button (static/app/views/issueList/issueViewsHeader.tsx:139:9)
- [ ] IconSubtract > Button (static/app/components/events/viewHierarchy/wireframe.tsx:337:13)
- [ ] IconSubtract > Button (static/app/views/explore/logs/tables/logsTableRow.tsx:630:9)
- [ ] IconSync > Button (static/app/components/events/autofix/autofixRootCause.tsx:244:13)
- [ ] IconSync > Button (static/app/views/replays/detail/ai/ai.tsx:130:21)
- [ ] IconSync > Button (static/gsAdmin/views/overview.tsx:186:17)
- [ ] IconTelescope > Button (static/app/views/preprod/buildComparison/main/sizeCompareSelectedBuilds.tsx:241:17)
- [ ] IconUpdate > Button (static/app/views/discover/savedQuery/index.tsx:423:15)

### LinkButton

- [ ] IconGithub > LinkButton (static/app/views/settings/organizationIntegrations/exampleIntegrationButton.tsx:38:13)
- [ ] IconMoon > LinkButton (static/app/debug/notifications/components/debugNotificationsHeader.tsx:89:13)
- [ ] IconPlay > LinkButton (static/app/views/insights/browser/webVitals/components/tables/pageSamplePerformanceTable.tsx:470:17)
- [ ] IconProfiling > LinkButton (static/app/components/discover/transactionsTable.tsx:161:13)
- [ ] IconProfiling > LinkButton (static/app/views/insights/browser/webVitals/components/tables/pageSamplePerformanceTable.tsx:431:19)
- [ ] IconProfiling > LinkButton (static/app/views/insights/common/components/samplesTable/spanSamplesTable.tsx:225:17)
- [ ] IconProfiling > LinkButton (static/app/views/insights/mobile/screenload/components/tables/eventSamplesTable.tsx:110:17)
- [ ] IconProfiling > LinkButton (static/app/views/performance/transactionSummary/transactionEvents/eventsTable.tsx:319:19)
- [ ] IconStar > LinkButton (static/app/views/discover/savedQuery/index.tsx:341:15)

### StyledButton (verify wrapper forwards `icon` prop before migrating call site)

- [ ] IconAdd > StyledButton (static/app/views/dashboards/manage/templateCard.tsx:45:21)
- [ ] IconChevron > StyledButton (static/app/components/profiling/flamegraph/collapsibleTimeline.tsx:36:11)
- [ ] IconClose > StyledButton (static/gsApp/components/profiling/alerts.tsx:123:11)
- [ ] IconCopy > StyledButton (static/app/views/dashboards/manage/dashboardTable.tsx:296:25)
- [ ] IconDelete > StyledButton (static/app/views/dashboards/manage/dashboardTable.tsx:326:21)
- [ ] IconLightning > StyledButton (static/gsApp/views/amCheckout/components/cart.tsx:743:21)
- [ ] IconLock > StyledButton (static/gsApp/views/amCheckout/components/cart.tsx:754:19)
- [ ] IconPlay > StyledButton (static/app/views/replays/detail/timestampButton.tsx:59:9)
- [ ] IconSubtract > StyledButton (static/app/views/settings/organizationIntegrations/sentryAppDetailedView.tsx:353:15)

### DropdownButton

- [ ] IconChevron > DropdownButton (static/app/components/group/assignedTo.tsx:260:11)
- [ ] IconEllipsis > DropdownButton (static/app/views/preprod/buildComparison/header/buildCompareHeaderContent.tsx:185:21)
- [ ] IconEllipsis > DropdownButton (static/app/views/preprod/buildDetails/header/buildDetailsHeaderContent.tsx:290:23)

### ToggleButton (verify `icon` prop exists on component)

- [ ] IconChevron > ToggleButton (static/app/components/structuredEventData/collapsibleValue.tsx:65:13)
- [ ] IconChevron > ToggleButton (static/app/views/issueDetails/streamline/sidebar/toggleSidebar.tsx:29:11)
- [ ] IconChevron > ToggleButton (static/app/views/releases/detail/overview/releaseComparisonChart/releaseComparisonChartRow.tsx:105:21)
- [ ] IconChevron > ToggleButton (static/app/views/replays/detail/network/details/components.tsx:135:11)

### ActionLinkButton

- [ ] IconJson > ActionLinkButton (static/app/views/performance/newTraceDetails/traceDrawer/details/styles.tsx:1012:19)
- [ ] IconProfiling > ActionLinkButton (static/app/views/performance/newTraceDetails/traceDrawer/details/styles.tsx:1023:19)
- [ ] IconProfiling > ActionLinkButton (static/app/views/performance/newTraceDetails/traceDrawer/details/styles.tsx:1033:19)

### StatusToggleButton (verify `icon` prop exists on component)

- [ ] IconEdit > StatusToggleButton (static/app/views/alerts/rules/uptime/details.tsx:163:21)
- [ ] IconEdit > StatusToggleButton (static/app/views/insights/crons/components/monitorHeaderActions.tsx:116:15)

### Other custom wrappers (inspect each — may be intentional icon-only wrappers)

- [ ] IconAdd > IntegrationButton (static/app/components/prevent/integratedOrgSelector/integratedOrgSelector.tsx:106:17)
- [ ] IconAdd > IntegrationButton (static/gsApp/views/seerAutomation/onboarding/githubButton.tsx:60:63)
- [ ] IconSettings > IntegrationButton (static/gsApp/views/seerAutomation/onboarding/githubButton.tsx:60:44)
- [ ] IconAdd > MenuComponents.CTAButton (static/app/components/assigneeSelectorDropdown.tsx:562:21)
- [ ] IconAdd > MenuComponents.CTAButton (static/app/views/setupWizard/wizardProjectSelection.tsx:409:31)
- [ ] IconAdd > SelectionButton (static/app/components/events/autofix/autofixSolutionEventItem.tsx:160:21)
- [ ] IconClose > SelectionButton (static/app/components/events/autofix/autofixSolutionEventItem.tsx:158:21)
- [ ] IconDelete > SelectionButton (static/app/components/events/autofix/autofixSolutionEventItem.tsx:156:21)
- [ ] IconClose > DeleteButton (static/app/components/arithmeticBuilder/token/function.tsx:691:7)
- [ ] IconClose > DeleteButton (static/app/components/arithmeticBuilder/token/literal.tsx:279:7)
- [ ] IconClose > DeleteButton (static/app/components/searchQueryBuilder/tokens/boolean.tsx:50:7)
- [ ] IconClose > DeleteButton (static/app/components/searchQueryBuilder/tokens/filter/filter.tsx:194:7)
- [ ] IconClose > FloatingCloseButton (static/app/components/searchQueryBuilder/tokens/deletableToken.tsx:80:13)
- [ ] IconClose > FloatingCloseButton (static/app/components/tokenizedInput/token/deletableToken.tsx:88:11)
