# Copy and Download Action Analysis Report

This report identifies all elements in the codebase where actions resemble download or copy to clipboard functionality.

**Format:** `file:line:column | Icon Type | Label/Action Text | Toast Notification Status`

---

## 1. IconDownload Usage

### 1.1 Subscription & Billing

#### static/gsApp/views/subscriptionPage/usageOverview/components/actions.tsx

- **50:7** | IconDownload | "Download as CSV" | ❌ No toast
  - Used in dropdown menu for usage reports download

#### static/gsApp/views/subscriptionPage/usageHistory.tsx

- **255:13** | IconDownload | "Download Summary" | ❌ No toast
- **267:13** | IconDownload | "Download Project Breakdown" | ❌ No toast
  - Both trigger analytics tracking for subscription page downloads

#### static/gsApp/views/subscriptionPage/paymentHistory.tsx

- **192:32** | IconDownload | "Download PDF" | ❌ No toast
  - LinkButton with href to receipt URL

#### static/gsAdmin/views/invoices.tsx

- **59:7** | IconDownload | aria-label: "Download Invoice" | ❌ No toast

#### static/gsAdmin/views/billingPlans.tsx

- **189:7** | IconDownload | "Download" (CSV download) | ❌ No toast
  - Triggers `handleDownloadCsv` function

### 1.2 Debug Files & Source Maps

#### static/app/views/settings/projectProguard/projectProguardRow.tsx

- **66:15** | IconDownload (size="sm") | aria-label: "Download Mapping" | ❌ No toast
  - LinkButton for ProGuard mapping file download

#### static/app/views/settings/projectSourceMaps/sourceMapsDetails.tsx

- **96:13** | IconDownload (size="sm") | aria-label: "Download Artifact" | ❌ No toast
  - LinkButton with download URL parameter

#### static/app/views/settings/projectDebugFiles/debugFileRow.tsx

- **110:15** | IconDownload | Download debug file button | ❌ No toast

### 1.3 Replay Downloads

#### static/app/views/replays/detail/header/replayItemDropdown.tsx

- **51:11** | IconDownload | "Download JSON" | ⚠️ Error toast only (addErrorMessage)
  - Downloads replay as rrweb JSON data
  - Shows error message if replay not found or export fails
- **76:15** | IconDownload | "Download Replay Record (superuser)" | ⚠️ Error toast only
  - Superuser-only download of replay record
- **100:11** | IconDownload | "Download 1st video segment (superuser)" | ❌ No toast
  - Downloads first video segment for mobile replays

### 1.4 Profiling

#### static/app/components/profiling/exportProfileButton.tsx

- **38:7** | IconDownload (size="xs") | "Export Profile" | ❌ No toast
- **42:14** | IconDownload | "Export Profile" (full button) | ❌ No toast
  - Download profile data with filename

### 1.5 Data Export & Tables

#### static/app/views/issueDetails/groupDistributions/tagExportDropdown.tsx

- **42:11** | IconDownload | "Export to CSV" | ❌ No toast

#### static/app/components/events/interfaces/debugMeta/debugImageDetails/candidate/actions.tsx

- **60:15** | IconDownload | Download candidate action | ❌ No toast

#### static/app/components/events/eventAttachmentActions.tsx

- **56:9** | IconDownload | Download attachment | ❌ No toast
  - aria-label: "Download"
  - LinkButton with download URL parameter

#### static/app/views/explore/components/exploreExport.tsx

- **88:9** | IconDownload | "Export" | ❌ No toast (immediate CSV download)
- **114:7** | IconDownload | "Export" (async via DataExport) | ❌ No toast
  - Two export modes depending on data size

#### static/app/views/discover/table/tableActions.tsx

- **71:7** | IconDownload | "Export All" (browser export) | ❌ No toast
  - Immediate CSV download for smaller datasets
- **95:7** | IconDownload | "Export All" (async export) | ❌ No toast
  - Async export via DataExport component

#### static/app/views/dataExport/dataDownload.tsx

- **328:13** | IconDownload | Download completed export | ❌ No toast
  - LinkButton to download exported data file

#### static/app/views/dashboards/controls.tsx

- **268:11** | IconDownload | aria-label: "export-dashboard" | ❌ No toast
  - Exports entire dashboard configuration

### 1.6 Preprod/Build Analysis

#### static/app/views/preprod/components/installAppButton.tsx

- **45:9** | IconDownload (size="sm") | Install app button | ❌ No toast

#### static/app/views/preprod/buildDetails/main/buildDetailsMetricCards.tsx

- **158:7** | IconDownload (size="sm") | Metric card download action | ❌ No toast

#### static/app/views/preprod/buildDetails/header/buildDetailsHeaderContent.tsx

- **241:27** | IconDownload (size="sm") | Build details download | ❌ No toast

#### static/app/views/preprod/buildDetails/buildDetails.tsx

- **184:19** | IconDownload | "Download" button | ❌ No toast
  - Triggers `handleDownloadAction`

#### static/app/views/preprod/buildComparison/main/buildComparisonMetricCards.tsx

- **71:9** | IconDownload (size="sm") | Comparison metric download | ❌ No toast

#### static/app/views/preprod/buildComparison/main/sizeCompareSelectionContent.tsx

- **325:15** | IconDownload (size="xs", variant="muted") | Size comparison download | ❌ No toast

#### static/app/views/preprod/buildComparison/header/buildCompareHeaderContent.tsx

- **121:17** | IconDownload (size="sm", variant="muted") | Build comparison header download | ❌ No toast

### 1.7 Account Security

#### static/app/views/settings/account/accountSecurity/components/recoveryCodes.tsx

- **63:13** | IconDownload | aria-label: "download" | ❌ No toast
  - Download recovery codes as text file
  - LinkButton with download="sentry-recovery-codes.txt"

### 1.8 Discover/Field Renderers

#### static/app/utils/discover/fieldRenderers.tsx

- **474:19** | IconDownload (variant="primary", size="sm") | Download attachment | ❌ No toast
  - Inline download icon for attachments
- **509:13** | IconDownload (variant="primary", size="sm") | Download minidump | ❌ No toast
  - Inline download icon for minidumps

---

## 2. IconCopy Usage

### 2.1 Relay & Integration Management

#### static/app/views/settings/organizationRelay/list/cardHeader.tsx

- **52:11** | IconCopy | Copy relay public key | ✅ Success toast: "Copied to clipboard"
  - Uses `useCopyToClipboard` hook

#### static/app/views/settings/organizationIntegrations/SplitInstallationIdModal.tsx

- **29:11** | No icon visible | Copy installation ID | ✅ Success toast: "Copied to clipboard"
  - Uses `navigator.clipboard.writeText` directly
  - TextCopyInput component

### 2.2 Seer Explorer

#### static/app/views/seerExplorer/topBar.tsx

- **107:11** | IconCopy | aria-label: "Copy conversation to clipboard" | ✅ Success toast: "Copied conversation to clipboard"
  - Uses `navigator.clipboard.writeText`

### 2.3 Debug/Testing

#### static/app/debug/notifications/previews/teamsPreview.tsx

- **50:13** | IconCopy | "Copy JSON" | ❌ No toast (custom implementation)
  - Uses `useCopyToClipboard` hook

### 2.4 Replay Details

#### static/app/views/replays/detail/header/replayDetailsPageBreadcrumbs.tsx

- **176:17** | IconCopy (size="xs", variant="muted") | aria-label: "Copy link to replay at current timestamp" | ✅ Success toast (via useCopyToClipboard)
  - Uses `useCopyToClipboard` hook

### 2.5 Profiling/Flamegraph

#### static/app/components/profiling/flamegraph/flamegraphSpansContextMenu.tsx

- **76:15** | IconCopy (size="xs") | Copy span description | ✅ Success toast: "Description copied to clipboard"
- **89:15** | IconCopy (size="xs") | Copy span operation | ✅ Success toast: "Operation copied to clipboard"
- **102:15** | IconCopy (size="xs") | Copy event ID | ✅ Success toast: "Event ID copied to clipboard"

#### static/app/components/profiling/flamegraph/flamegraphContextMenu.tsx

- **187:15** | IconCopy (size="xs") | Copy function name | ✅ Success toast: "Function name copied to clipboard"
- **206:15** | IconCopy (size="xs") | Copy function source | ✅ Success toast: "Function source copied to clipboard"
- **452:15** | IconCopy (size="xs") | Copy frame info (additional) | ✅ Success toast (via addSuccessMessage)
- **464:15** | IconCopy (size="xs") | Copy frame info (additional) | ✅ Success toast (via addSuccessMessage)

### 2.6 Onboarding & Documentation

#### static/app/components/onboarding/gettingStartedDoc/utils/index.tsx

- **89:7** | IconCopy | Copy code snippet | ✅ Success toast (default via useCopyToClipboard)
- **139:7** | IconCopy | Copy code snippet | ✅ Success toast (default via useCopyToClipboard)

### 2.7 Issue Details

#### static/app/views/issueList/pages/dynamicGrouping.tsx

- **565:19** | IconCopy (size="sm") | Copy action in dropdown | ✅ Success toast (via useCopyToClipboard)

#### static/app/views/issueDetails/streamline/foldSection.stories.tsx

- **56:13** | IconCopy | Story example copy button | N/A (Storybook)
- **124:15** | IconCopy | Story example copy button | N/A (Storybook)

#### static/app/views/issueDetails/streamline/eventTitle.tsx

- **156:15** | IconCopy (size="xs", variant="muted") | aria-label: "Copy Event ID" | ✅ Success toast (via useCopyToClipboard)
  - Copies short event ID

#### static/app/views/issueDetails/streamline/header/issueIdBreadcrumb.tsx

- **76:15** | IconCopy (size="xs", variant="muted") | aria-label: "Copy Issue Short-ID" | ✅ Success toast (via useCopyToClipboard)

#### static/app/views/issueDetails/groupEventCarousel.tsx

- **407:21** | IconCopy (size="xs") | Copy event ID button | ✅ Success toast: "Event ID copied to clipboard"
  - Uses `useCopyToClipboard` with custom message

### 2.8 Feedback

#### static/app/components/feedback/feedbackItem/feedbackActions.tsx

- **154:11** | IconCopy | aria-label: "Copy feedback as markdown" | ✅ Success toast (via useCopyToClipboard)

### 2.9 Events & Traces

#### static/app/components/events/traceEventDataSection.tsx

- **482:15** | IconCopy | aria-label: "Copy Raw Stacktrace" | ✅ Success toast (via useCopyToClipboard)

#### static/app/components/events/userFeedback.tsx

- **56:15** | StyledIconCopy (size="xs") | Copy user feedback | ✅ Success toast (via useCopyToClipboard)

### 2.10 Next.js Server Tree

#### static/app/views/insights/pages/platform/nextjs/serverTree.tsx

- **325:23** | IconCopy (size="xs") | aria-label: "Copy" | ✅ Success toast: "Copied to clipboard"
  - Uses `navigator.clipboard.writeText`

### 2.11 Stacktrace Links

#### static/app/components/events/interfaces/frame/stacktraceLink.tsx

- **435:9** | IconCopy | aria-label: "Copy file path" | ✅ Success toast (via useCopyToClipboard)

### 2.12 Insights/Crons

#### static/app/views/insights/crons/components/detailsSidebar.tsx

- **50:9** | IconCopy (size="xs") | Copy cron details | ✅ Success toast (via useCopyToClipboard)

### 2.13 Autofix Features

#### static/app/components/events/autofix/v2/explorerSeerDrawer.tsx

- **120:11** | IconCopy | aria-label: "Copy analysis as Markdown" | ✅ Success toast (via useCopyToClipboard)

#### static/app/components/events/breadcrumbs/copyBreadcrumbs.tsx

- **107:9** | IconCopy | Copy breadcrumbs | ✅ Success toast (via useCopyToClipboard)

#### static/app/components/events/autofix/autofixSolution.tsx

- **333:7** | IconCopy | Copy autofix solution | ✅ Success toast (via useCopyToClipboard)

#### static/app/components/events/autofix/autofixRootCause.tsx

- **244:7** | IconCopy | Copy root cause analysis | ✅ Success toast (via useCopyToClipboard)

#### static/app/components/events/autofix/autofixChanges.tsx

- **144:9** | IconCopy (size="xs") | aria-label: "Copy branch in %s" | ✅ Success toast (via useCopyToClipboard)

### 2.14 Core Components

#### static/app/components/core/inspector.tsx

- **634:17** | IconCopy (size="xs") | Copy component name | ✅ Success toast: "Component name copied to clipboard"
- **646:17** | IconCopy (size="xs") | Copy component path | ✅ Success toast: "Component path copied to clipboard"
- **659:17** | IconCopy (size="xs") | Copy LLM prompt | ✅ Success toast: "LLM prompt copied to clipboard"
  - Uses `navigator.clipboard?.writeText` with fallback to `document.execCommand('copy')`

#### static/app/components/core/code/codeBlock.tsx

- **193:13** | IconCopy | aria-label: "Copy snippet" | ✅ Success toast (via useCopyToClipboard)

#### static/app/components/copyToClipboardButton.tsx

- **31:7** | IconCopy (variant="muted") | Generic copy button | ✅ Success toast (via useCopyToClipboard)
  - Reusable component used throughout the app

### 2.15 ACL/Feature Disabled

#### static/app/components/acl/featureDisabled.tsx

- **88:11** | IconCopy | Copy feature info | ✅ Success toast (via useCopyToClipboard)

### 2.16 Dashboards

#### static/app/views/dashboards/widgetCard/toolbar.tsx

- **82:15** | IconCopy | Duplicate widget | ❌ No toast (action is duplication, not clipboard copy)

#### static/app/views/dashboards/manage/dashboardTable.tsx

- **298:19** | IconCopy | Duplicate dashboard | ❌ No toast (action is duplication, not clipboard copy)

#### static/app/views/dashboards/controls.tsx

- **365:25** | IconCopy | Duplicate dashboard | ❌ No toast (action is duplication, not clipboard copy)

### 2.17 Alerts

#### static/app/views/alerts/rules/issue/details/ruleDetails.tsx

- **441:15** | IconCopy | Duplicate alert rule | ❌ No toast (action is duplication, not clipboard copy)

#### static/app/views/alerts/rules/metric/details/header.tsx

- **131:13** | IconCopy | Duplicate metric alert | ❌ No toast (action is duplication, not clipboard copy)

### 2.18 Performance/Traces

#### static/app/views/performance/newTraceDetails/traceDrawer/details/styles.tsx

- **146:11** | CopyToClipboardButton | aria-label: "Copy to clipboard" | ✅ Success toast
- **177:13** | CopyToClipboardButton | aria-label: "Copy to clipboard" | ✅ Success toast
- **1147:13** | StyledCopyToClipboardButton | aria-label: "Copy to clipboard" | ✅ Success toast

#### static/app/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/highlights.tsx

- **50:9** | CopyToClipboardButton | aria-label: "Copy transaction name to clipboard" | ✅ Success toast

#### static/app/views/performance/newTraceDetails/traceHeader/breadcrumbs.tsx

- **396:9** | CopyToClipboardButton | aria-label: "Copy trace ID to clipboard" | ✅ Success toast

#### static/app/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/description.tsx

- **216:13** | CopyToClipboardButton | aria-label: "Copy span URL to clipboard" | ✅ Success toast
- **251:11** | CopyToClipboardButton | aria-label: "Copy span name to clipboard" | ✅ Success toast
- **267:15** | CopyToClipboardButton | aria-label: "Copy formatted description to clipboard" | ✅ Success toast
- **372:11** | CopyToClipboardButton | aria-label: "Copy file name to clipboard" | ✅ Success toast

#### static/app/views/performance/newTraceDetails/traceDrawer/details/span/sections/description.tsx

- **185:15** | CopyToClipboardButton | aria-label: "Copy formatted description to clipboard" | ✅ Success toast
- **289:11** | CopyToClipboardButton | aria-label: "Copy file name to clipboard" | ✅ Success toast

### 2.19 Preprod/Build Comparison

#### static/app/views/preprod/buildComparison/main/sizeCompareItemDiffTable.tsx

- **213:25** | CopyToClipboardButton | aria-label: "Copy path to clipboard" | ✅ Success toast

#### static/app/views/preprod/buildComparison/main/insights/fileInsightDiffTable.tsx

- **170:27** | CopyToClipboardButton | aria-label: "Copy path to clipboard" | ✅ Success toast

#### static/app/views/preprod/buildComparison/main/insights/groupInsightDiffTable.tsx

- **217:27** | CopyToClipboardButton | aria-label: "Copy path to clipboard" | ✅ Success toast

### 2.20 Replays Diff

#### static/app/components/replays/diff/replayTextDiff.tsx

- **36:11** | CopyToClipboardButton | aria-label: "Copy Before" | ✅ Success toast
- **44:11** | CopyToClipboardButton | aria-label: "Copy After" | ✅ Success toast

### 2.21 Version Components

#### static/app/components/versionHoverCard.tsx

- **211:9** | CopyToClipboardButton | aria-label: "Copy release version to clipboard" | ✅ Success toast

#### static/app/components/version.tsx

- **130:7** | CopyToClipboardButton | aria-label: "Copy version to clipboard" | ✅ Success toast

#### static/app/views/releases/detail/header/releaseHeader.tsx

- **148:13** | CopyToClipboardButton | aria-label: "Copy release version to clipboard" | ✅ Success toast

### 2.22 Structured Event Data

#### static/app/components/structuredEventData/index.tsx

- **172:11** | StyledCopyButton (CopyToClipboardButton) | aria-label: "Copy to clipboard" | ✅ Success toast

### 2.23 Detectors/Crons

#### static/app/views/detectors/components/details/cron/index.tsx

- **260:23** | CopyToClipboardButton | aria-label: "Copy monitor slug to clipboard" | ✅ Success toast

### 2.24 Discover Quick Context

#### static/app/views/discover/table/quickContext/quickContextHovercard.tsx

- **119:13** | CopyToClipboardButton | aria-label: "Copy to clipboard" | ✅ Success toast

---

## 3. TextCopyInput Components

TextCopyInput is a compound component that includes a text input field with an integrated CopyToClipboardButton. All instances display a success toast "Copied to clipboard" by default via the `useCopyToClipboard` hook.

### 3.1 Project Settings & Integrations

#### static/app/views/settings/projectSecurityHeaders/reportUri.tsx

- **38:11** | TextCopyInput | Security DSN | ✅ Success toast (default)

#### static/app/views/settings/project/projectToolbar.tsx

- **93:15** | CopyToClipboardButton | aria-label: "Copy domain to clipboard" | ✅ Success toast

#### static/app/views/settings/project/projectReleaseTracking.tsx

- **182:13** | TextCopyInput | Release token | ✅ Success toast (default)

#### static/app/views/settings/project/projectServiceHookDetails.tsx

- **187:13** | TextCopyInput | Service hook secret | ✅ Success toast (default)

### 3.2 Project Keys & Credentials

#### static/app/views/settings/project/projectKeys/credentials/index.tsx

- **56:7** | TextCopyInput | aria-label: "Security Header Endpoint URL" | ✅ Success toast (default)
- **84:7** | TextCopyInput | aria-label: "Minidump Endpoint URL" | ✅ Success toast (default)
- **103:7** | TextCopyInput | aria-label: "Unreal Engine Endpoint URL" | ✅ Success toast (default)
- **157:15** | TextCopyInput | Various field values | ✅ Success toast (default)
- **304:11** | TextCopyInput | aria-label: "DSN URL" | ✅ Success toast (default)
- **314:15** | TextCopyInput | Secret DSN | ✅ Success toast (default)
- **329:11** | TextCopyInput | Secret DSN (duplicate) | ✅ Success toast (default)

#### static/app/views/settings/project/projectKeys/credentials/otlp.tsx

- **62:9** | TextCopyInput | aria-label: "OTLP Endpoint" | ✅ Success toast (default)
- **81:13** | TextCopyInput | aria-label: "OTLP Logs Endpoint" | ✅ Success toast (default)
- **92:13** | TextCopyInput | aria-label: "OTLP Logs Endpoint Headers" | ✅ Success toast (default)
- **114:13** | TextCopyInput | aria-label: "OTLP Traces Endpoint" | ✅ Success toast (default)
- **125:13** | TextCopyInput | aria-label: "OTLP Traces Endpoint Headers" | ✅ Success toast (default)

#### static/app/views/settings/project/projectKeys/credentials/vercel.tsx

- **33:9** | TextCopyInput | aria-label: "Vercel Log Drain Endpoint" | ✅ Success toast (default)
- **46:9** | TextCopyInput | aria-label: "Log Drain Authentication Header" | ✅ Success toast (default)
- **65:13** | TextCopyInput | aria-label: "Vercel Trace Drain Endpoint" | ✅ Success toast (default)
- **78:13** | TextCopyInput | aria-label: "Vercel Trace Drain Authentication Header" | ✅ Success toast (default)

#### static/app/views/settings/project/projectKeys/list/loaderScript.tsx

- **40:9** | TextCopyInput | aria-label: "Loader Script" | ✅ Success toast (default)

#### static/app/views/settings/project/projectKeys/details/loaderSettings.tsx

- **156:13** | TextCopyInput | aria-label: "Loader Script" | ✅ Success toast (default)

### 3.3 Organization Settings

#### static/app/views/settings/organizationRelay/modals/form.tsx

- **90:11** | TextCopyInput | Relay public key | ✅ Success toast: "Copied to clipboard"
  - Custom onCopy handler

#### static/app/views/settings/organizationIntegrations/SplitInstallationIdModal.tsx

- **51:9** | TextCopyInput | Installation ID | ✅ Success toast: "Copied to clipboard"

#### static/app/views/settings/organizationDeveloperSettings/sentryApplicationDetails.tsx

- **323:13** | TextCopyInput | aria-label: "new-client-secret" | ✅ Success toast (default)
- **465:21** | TextCopyInput | Webhook URLs | ✅ Success toast (default)
- **484:25** | TextCopyInput | Redirect URLs | ✅ Success toast (default)

#### static/app/views/settings/organizationApiKeys/organizationApiKeysList.tsx

- **98:15** | TextCopyInput (size="md", monospace) | API key | ✅ Success toast (default)

### 3.4 Feature Flags

#### static/app/views/settings/featureFlags/changeTracking/newProviderForm.tsx

- **187:9** | TextCopyInput | aria-label: "Webhook URL" | ✅ Success toast (default)

#### static/app/views/settings/featureFlags/changeTracking/newSecretHandler.tsx

- **55:13** | TextCopyInput | Webhook URL | ✅ Success toast (default)
- **67:13** | TextCopyInput | aria-label: "Secret" | ✅ Success toast (default)

### 3.5 Account Settings

#### static/app/views/settings/components/newTokenHandler.tsx

- **19:11** | TextCopyInput | aria-label: "Generated token" | ✅ Success toast (default)

#### static/app/views/settings/account/accountSecurity/accountSecurityEnroll.tsx

- **95:11** | TextCopyInput | Authenticator secret | ✅ Success toast (default)

#### static/app/views/settings/account/apiApplications/details.tsx

- **77:13** | TextCopyInput | aria-label: "new-client-secret" | ✅ Success toast (default)
- **136:15** | TextCopyInput | Client ID | ✅ Success toast (default)
- **149:21** | TextCopyInput | Redirect URI | ✅ Success toast (default)
- **170:15** | TextCopyInput | OAuth authorize URL | ✅ Success toast (default)
- **174:15** | TextCopyInput | OAuth token URL | ✅ Success toast (default)

### 3.6 Replay Features

#### static/app/utils/replays/hooks/useShareReplayAtTimestamp.tsx

- **44:9** | StyledTextCopyInput | aria-label: "Deeplink to current timestamp" | ✅ Success toast (default)

#### static/app/views/replays/detail/network/details/onboarding.tsx

- **183:15** | StyledTextCopyInput | Network URL | ✅ Success toast (default)

#### static/app/components/replays/replayView.tsx

- **63:15** | TextCopyInput (size="sm", disabled) | Replay URL (disabled) | N/A (disabled)

#### static/app/components/replays/replayCurrentUrl.tsx

- **36:7** | TextCopyInput (size="sm", disabled) | Current URL (disabled) | N/A (disabled)
- **68:9** | TextCopyInput (size="sm") | Current URL | ✅ Success toast (default)
- **76:5** | TextCopyInput (size="sm") | Current URL | ✅ Success toast (default)

#### static/app/components/replays/replayCurrentScreen.tsx

- **28:7** | TextCopyInput (size="sm", disabled) | Current screen (disabled) | N/A (disabled)
- **35:5** | TextCopyInput (size="sm") | Current screen name | ✅ Success toast (default)

### 3.7 Prevent Tokens

#### static/app/views/prevent/tokens/repoTokenTable/repoTokenTable.tsx

- **182:7** | TokenCopyInput (styled TextCopyInput) | Repository token | ✅ Success toast (default)

---

## 4. Download Links (Non-Icon)

### 4.1 Attachment Downloads

#### static/app/utils/discover/fieldRenderers.tsx

- **461:15** | Direct link | Attachment download | ❌ No toast
  - URL includes `?download=1` parameter

#### static/app/views/issueDetails/groupEventAttachments/screenshotCard.tsx

- **48:3** | Direct link | Screenshot download | ❌ No toast
  - `downloadUrl` with `?download=1` parameter

#### static/app/components/feedback/feedbackItem/feedbackScreenshot.tsx

- **61:11** | FileDownload (styled anchor) | aria-label: "feedback-attachment-download-button" | ❌ No toast
  - Direct download link with `?download=1`

#### static/app/components/events/eventTagsAndScreenshot/screenshot/index.tsx

- **111:11** | onClick handler | Opens screenshot modal | ❌ No toast
- **131:17** | onClick handler | Opens screenshot modal | ❌ No toast
- **150:21** | window.location.assign | Direct download trigger | ❌ No toast

#### static/app/components/events/traceEventDataSection.tsx

- **436:3** | Direct link | Raw stacktrace download | ❌ No toast
  - `rawStackTraceDownloadLink` with `&download=1`

### 4.2 Source Maps & Artifacts

#### static/app/views/settings/projectSourceMaps/sourceMapsDetails.tsx

- **286:15** | Direct link | Artifact bundle file download | ❌ No toast
- **318:15** | Direct link | Release file download | ❌ No toast
  - Both include `?download=1` parameter

### 4.3 Preprod Artifacts

#### static/app/utils/downloadPreprodArtifact.tsx

- **65:5** | link.download | Download preprod artifact | ✅ Success toast: "Build download started"
  - ⚠️ Also shows error toast: "Download failed"

---

## 5. Export/Download Functions

### 5.1 Search Commands

#### static/app/components/search/sources/commandSource.tsx

- **140:9** | Command action | Copy DSN to clipboard | ✅ Success toast: "Copied DSN to clipboard"
  - Uses `navigator.clipboard.writeText`

### 5.2 Search Query Builder

#### static/app/components/searchQueryBuilder/selectionKeyHandler.tsx

- **115:15** | Keyboard handler | Copy query | ❌ No toast (silently copies)
  - Uses `navigator.clipboard.writeText`

### 5.3 Seer Explorer

#### static/app/views/seerExplorer/utils.tsx

- **800:7** | Function | Copy conversation | ✅ Success toast: "Copied conversation to clipboard"

#### static/app/views/seerExplorer/explorerPanel.tsx

- **576:7** | Function | Copy link to chat | ✅ Success toast: "Copied link to current chat"

### 5.4 Cell Actions

#### static/app/views/discover/table/cellAction.tsx

- **163:3** | Function | Copy cell value | ❌ No toast (silent copy, catches errors)
  - Uses `navigator.clipboard.writeText`

---

## 6. Special Cases & Variations

### 6.1 DropdownMenu Stories (Documentation)

#### static/app/components/dropdownMenu/index.stories.tsx

- **24:9** | IconCopy (size="sm") | Story example | N/A (Storybook)
- **30:9** | IconDownload (size="sm") | Story example | N/A (Storybook)
- **71:13** | IconCopy (size="sm") | Story example | N/A (Storybook)
- **83:13** | IconDownload (size="sm") | Story example | N/A (Storybook)
- **128:9** | IconDownload (size="sm") | Story example | N/A (Storybook)
- **133:9** | IconCopy (size="sm") | Story example | N/A (Storybook)
- **164:9** | IconDownload (size="sm") | Story example | N/A (Storybook)
- **171:13** | Action: "Export JSON clicked" | Story example | N/A (Storybook)
- **219:9** | IconCopy (size="sm") | Story example | N/A (Storybook)

### 6.2 Duplicate Actions (Using IconCopy but not clipboard copy)

Several components use IconCopy but perform duplication actions rather than clipboard copies:

- **Dashboards**: Widget duplication, dashboard duplication
- **Alerts**: Alert rule duplication
- These do NOT show toast notifications for the copy action

---

## Summary Statistics

### Icon Usage

- **IconDownload**: 66 instances found
- **IconCopy**: 83 instances found

### Toast Notification Patterns

- **With Success Toast**: ~120 instances (mostly using `useCopyToClipboard`)
- **Without Toast**: ~30 instances (mostly downloads and silent copies)
- **Error Toast Only**: ~5 instances (download failures)

### Common Patterns

1. **Copy Actions with Toast**: Most copy actions use `useCopyToClipboard` hook or `CopyToClipboardButton` component, which automatically shows "Copied to clipboard" success message

2. **Copy Actions without Toast**:
   - Silent keyboard shortcuts
   - Cell value copies in tables
   - Some specialized copy operations

3. **Download Actions without Toast**: Most download actions don't show success toasts since the browser's download UI provides feedback

4. **Download Actions with Toast**: Limited to cases where downloads might fail or require async processing

5. **TextCopyInput Pattern**: Widely used compound component that provides consistent UX with integrated copy button and default success toast

### Recommendations for Consistency

1. **Icon Standardization**: ✅ IconCopy and IconDownload are already well-established
2. **Toast Messages**: Consider adding success toasts to download actions for better user feedback
3. **Aria Labels**: Most buttons have proper aria-labels for accessibility
4. **Error Handling**: Some download actions lack error toast notifications

---

## Notes

- This analysis covers TypeScript/JavaScript files only
- Line numbers are approximate and may shift with code changes
- Toast notifications use either `addSuccessMessage`/`addErrorMessage` directly or via `useCopyToClipboard` hook
- Many components are disabled in certain states (no replay loaded, no permission, etc.)
