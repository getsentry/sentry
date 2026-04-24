---
name: replay-ux-research
description: Surface a "day in the life" of users interacting with a Sentry product area by analyzing session replays from external users. Use when asked to "show me how users use", "day in the life", "UX research", "replay research", "how do customers use", "what's the user experience like for", "watch replays of", "analyze replays for", "user behavior on", or "replay UX audit" for any Sentry product surface.
argument-hint: '<product-area>'
---

# Replay UX Research

Analyze session replays from real external users of sentry.io to surface UX patterns, pain points, and representative journeys for a given product area. This uses Sentry's own dogfooding org.

## Inputs

`$ARGUMENTS` is the product area to research (e.g., "issues", "alerts", "dashboards", "performance", "replays", "crons", "releases", "insights").

If `$ARGUMENTS` is empty, ask the user which product area to research.

## Step 1: Map product area to URL patterns

Read `references/product-areas.md` and find the URL patterns for the requested area.

If the product area is not listed, infer a URL pattern from the area name. Most Sentry product areas follow the pattern `/<area-name>/` in the URL path. Confirm your assumption with the user if unclear.

## Step 2: Search for replays

Search for at least 25 replays from external (non-Sentry-employee) users. Start with last 24 hours — extend to 48h or 7d if needed to reach 25.

Run multiple `search_events` calls if needed. Use `limit: 50` per call.

**Query construction:**

Use natural language queries like:

```
replays from the last 24 hours where url contains "/<area-path>" excluding user emails ending in @sentry.io and @getsentry.com
```

Key filters:

- **Time range**: last 24 hours (extend if < 25 results)
- **URL pattern**: match the product area paths from Step 1
- **Exclude employees**: `-user.email:*@sentry.io -user.email:*@getsentry.com`
- **Environment**: prod

If < 25 results, broaden the URL pattern or extend the time range. Do NOT pass a `projectSlug` filter — replays span the whole org.

## Step 3: Get replay details

Call `get_replay_details` for each replay found in Step 2. Run these calls in parallel batches for speed.

For each replay, capture:

- **User**: email domain (NOT full email — anonymize to protect privacy), geo if available
- **Journey**: ordered list of pages visited (from URLs and activity breadcrumbs)
- **Duration**: total session length
- **Replay type**: `session` (randomly sampled from normal browsing) vs `buffer` (triggered by an event — error, manual flush, or specific user action like submitting feedback or going through checkout). Note this distinction in your analysis since buffer replays are biased toward error/action moments, not typical browsing.
- **Entry context**: first URL tells you how they arrived — look for referrer signals like `referrer=slack`, `notification_uuid`, `alert_rule_id` in query params (Slack notification), email link patterns, or bare URLs (bookmark/direct nav)
- **Engagement signals**: error count, rage clicks, dead clicks, warning count
- **Browser/OS/Device**: for device distribution context
- **Activity breadcrumbs**: page views, navigation patterns, key interactions

## Step 3.5: Investigate significant errors

After collecting replay details, identify errors that appear in multiple replays or seem likely to affect the user experience. For each significant error:

1. **Triage by frequency**: If the same issue ID (e.g., `JAVASCRIPT-33RM`) appears in 3+ replays, it's worth investigating.
2. **Check the issue in Sentry**: Use `search_issues` to find the issue, or `get_sentry_resource` with the issue URL from the replay details. Understand:
   - What is the error? (message, stack trace context)
   - How many total users/events does it affect? (beyond just this replay sample)
   - Is it assigned or being worked on?
3. **Infer user-facing impact from behavioral signals**: We cannot see the rendered page content through replay metadata — only by watching the replay in-browser. Instead, infer impact from what users did _after_ the error:
   - **Retried the same action** → they likely saw a failure and tried again
   - **Navigated away immediately** → they were blocked or gave up
   - **Continued their flow normally** → the error may be silent/cosmetic
   - **Rage-clicked or dead-clicked after** → the UI may have become unresponsive
   - **Spent a long time on the page after** → they may be reading an error message or confused
   - **No behavioral change at all** → error was likely invisible to the user
4. **Classify each error** based on this evidence:
   - **Likely blocking**: Error + user retried/left/couldn't continue. High confidence of user impact.
   - **Likely degrading**: Error + user continued but with unusual behavior. Moderate confidence.
   - **Likely silent**: Error fired but user behavior was unaffected. Low confidence of user impact.
   - **Unclear**: Not enough behavioral signal to judge. Flag for manual replay review.

   Always note the confidence level and recommend watching specific replays to confirm. Link directly to the replay URL for each classified error.

Include this classification in the Friction & Pain Points section. Don't report likely-silent errors as pain points — list them in a separate "Background Errors (likely silent)" subsection for completeness.

## Step 4: Analyze patterns

Look at the replays through these UX research lenses:

### Behavioral patterns

1. **Common journeys**: What navigation paths do users take? What's the typical flow?
2. **Entry points**: How do users arrive? Categorize: alert notification (Slack/email), direct bookmark, organic navigation from another page. The first URL's query params reveal this.
3. **Task completion**: Did the user appear to accomplish a goal, or did they wander/abandon? Signs of completion: navigating to a detail view then leaving. Signs of abandonment: short session, back-and-forth navigation, leaving from the same page they entered.
4. **Time on task**: How long do users spend on key pages before acting?

### Friction & discovery

5. **Friction signals**: Rage clicks, dead clicks, errors — but also _hesitation_ (visiting the same page repeatedly), _thrashing_ (rapid back-and-forth between pages), and _retry loops_ (repeating the same action sequence).
6. **Feature discovery**: Are users finding sub-features (filters, search, sort, bulk actions) or only using the primary view? Look at URL query params and breadcrumbs for evidence of feature use.
7. **User intent signals**: Mine URL query params for search terms, filter values, sort orders, and date ranges users set. These are the closest thing to verbatim user "quotes" — they reveal what users are looking for in their own words. (e.g., `query=is%3Aunresolved+assigned%3Ame` tells you the user is triaging their own assigned issues.)
8. **Workarounds**: Any unexpected navigation patterns that suggest a missing feature or confusing flow? (e.g., going to settings mid-task, opening multiple pages in sequence that could be one view)
9. **Error recovery**: When users encounter errors, do they recover and continue or abandon?

### Context

10. **Replay trigger mix**: What proportion are `session` (random sample) vs `buffer` (event-triggered)? Buffer replays show moments where something notable happened (error, feedback submission, checkout, etc.) — they're valuable for friction analysis but aren't representative of typical browsing. Call out this bias when drawing conclusions.
11. **Return visitors**: Do any email domains appear in multiple replays? Repeat visitors suggest habitual usage — their journeys may reveal power-user patterns or persistent pain points they've learned to work around.
12. **User diversity**: Are replays from many different orgs/companies or concentrated? Are there differences in behavior by org?
13. **Device/browser distribution**: What are users primarily using?
14. **Drop-off points**: Where do users leave or navigate away?

## Step 5: Write the report

Use the output format below. Be specific — cite individual replays as evidence for each pattern. Link to replay URLs so the reader can watch the replay themselves.

**Privacy**: Never include full user email addresses in the report. Use anonymized identifiers like "user from [company domain]" or "User A, B, C."

## Output Format

```markdown
# Day in the Life: [Product Area] Users

**Scope**: [N] replays from external users, [time range], prod environment
**Date**: [today's date]

## Key Takeaways

1. [Most important UX finding — 1-2 sentences]
2. [Second finding]
3. [Third finding]
   (aim for 4-6 takeaways)

## Sample Composition

| Type                       | Count | %   | Notes                                                                                   |
| -------------------------- | ----- | --- | --------------------------------------------------------------------------------------- |
| `session` (random sample)  |       |     | Representative of normal browsing                                                       |
| `buffer` (event-triggered) |       |     | Triggered by error, feedback submission, checkout, etc. — biased toward notable moments |

[If heavily skewed toward buffer replays, note that findings over-represent error/action moments vs typical browsing.]

## How Users Arrive

Breakdown of entry points (e.g., "60% from Slack alert links, 25% direct/bookmark, 15% navigated from another page"). Cite referrer evidence from URL query params.

## Typical User Journeys

### Journey Pattern 1: [Name] (N/total replays)

[Describe the common navigation flow. What pages, in what order, how long. Did users appear to complete their task?]

**Example**: [Link to representative replay] — [brief description of what this user did]

### Journey Pattern 2: [Name] (N/total replays)

...

## Friction & Pain Points

### [Pain point 1]

- **Signal**: [rage clicks / dead clicks / errors / hesitation / thrashing / retry loop]
- **Where**: [specific page or interaction]
- **Impact classification**: [Likely blocking / Likely degrading / Unclear] — [behavioral evidence: what users did after]
- **Issue context**: [Sentry issue ID, total event/user count, assigned?]
- **Evidence**: [links to 2-3 replays showing this] — _watch these to confirm impact_
- **Severity**: [how many users hit this in the sample]

### [Pain point 2]

...

### Background Errors (likely silent)

Errors observed in replays where user behavior showed no signs of impact. Listed for completeness; watch linked replays to verify.

- [Issue ID] — [description] — [N replays] — [why classified as silent: user continued normally, no behavioral change]

## Feature Discovery & Gaps

- **Features actively used**: [list features/sub-pages users navigated to — filters, search, sort, bulk actions, etc.]
- **Features ignored**: [features available but not used by any observed users]
- **Possible workarounds observed**: [any unexpected navigation suggesting a missing feature or confusing flow]

## Session Characteristics

| Metric                         | Value                                                               |
| ------------------------------ | ------------------------------------------------------------------- |
| Median duration                |                                                                     |
| Sessions with errors           |                                                                     |
| Sessions with rage clicks      |                                                                     |
| Sessions with dead clicks      |                                                                     |
| Top browsers                   |                                                                     |
| Top devices                    |                                                                     |
| Unique orgs represented        |                                                                     |
| Estimated task completion rate | [% of sessions where user appeared to accomplish a goal vs abandon] |

## Notable Replays

Highlight 3-5 particularly interesting or illustrative replays:

1. [Replay link] — [Why it's notable: great example of X, shows unusual pattern Y, etc.]
2. ...

## Recommendations

Concrete, prioritized suggestions based on the evidence above:

1. **[Recommendation]** — [which finding(s) this addresses, expected impact]
2. ...

## What Users Are Looking For

Top search queries, filter combinations, and sort orders observed in URL params across replays. These are the closest thing to verbatim user quotes:

- `query=is:unresolved assigned:me` — [N users, triaging own assigned issues]
- `sort=date` — [N users, looking at most recent]
- ...

## Limitations

- **Sample size**: [N] replays over [time range]; this is directional, not statistically significant
- **Sampling bias**: Replays are captured at ~5% session sample rate, plus 100% on errors. [Note session/buffer split and what it means for representativeness]
- **Breadcrumb depth**: Activity breadcrumbs vary in richness per replay — some sessions have sparse data, limiting journey reconstruction
- **No click-level detail**: Breadcrumbs show page views and fetch calls but not every UI interaction. Rage/dead click counts are available but not the specific elements clicked
- **Single time window**: This is a snapshot, not a trend. Run again at different times to compare.
- [Add any other limitations specific to this run]

## Raw Data

<details>
<summary>All replays analyzed (click to expand)</summary>

| #   | Replay | Domain | Duration | Type           | Pages | Errors | Rage | Dead |
| --- | ------ | ------ | -------- | -------------- | ----- | ------ | ---- | ---- |
| 1   | [link] | ...    | ...      | session/buffer | ...   | ...    | ...  | ...  |

...

</details>
```
