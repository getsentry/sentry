# Sentry Product Area URL Patterns

Map product areas to URL path patterns for replay filtering. URLs follow the format `https://<org>.sentry.io/<path>`.

## Area Mapping

| Product Area  | Primary Pattern                   | Alternate Patterns                                                              | Notes                                                  |
| ------------- | --------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------ |
| issues        | `/issues`                         | `/issues/?`, `/issues/SHORTID`                                                  | Issue list and detail views                            |
| issue-details | `/issues/` followed by a number   | `/issues/123456/`                                                               | Single issue detail page only                          |
| alerts        | `/alerts`                         | `/alerts/rules/`, `/alerts/wizard/`                                             | Alert rules, wizard, and alert detail                  |
| dashboards    | `/dashboards`, `/dashboard`       | `/dashboards/new/`, `/dashboard/default-overview/`                              | Custom and default dashboards                          |
| performance   | `/performance`                    | `/performance/summary/`, `/performance/trends/`                                 | Transaction summaries, trends                          |
| insights      | `/insights`                       | `/insights/http/`, `/insights/db/`, `/insights/browser/`, `/insights/projects/` | Module-level insights views                            |
| replays       | `/replays`, `/explore/replays`    | `/explore/replays/`                                                             | Replay list and detail                                 |
| monitors      | `/monitors`                       | `/monitors/alerts/`, `/monitors/create/`                                        | All monitor types: cron, uptime, metric, mobile builds |
| releases      | `/releases`                       | `/releases/`, `/release/`                                                       | Release health and details                             |
| discover      | `/discover`, `/explore`           | `/explore/saved-queries/`, `/discover/results/`                                 | Discover queries and explore                           |
| profiling     | `/profiling`                      | `/profiling/`, `/profiling/content/`                                            | Profiling flamegraphs                                  |
| settings      | `/settings`                       | `/settings/projects/`, `/settings/teams/`, `/settings/account/`                 | Org and project settings                               |
| projects      | `/projects`                       | `/projects/`                                                                    | Project listing and setup                              |
| stats         | `/stats`                          | `/stats/`                                                                       | Org usage stats                                        |
| onboarding    | `/getting-started`, `/onboarding` |                                                                                 | First-time setup flows                                 |
| feedback      | `/feedback`                       | `/feedback/`                                                                    | User feedback / crash reports                          |

## Query Construction Examples

For "issues":

```
replays from the last 24 hours where url contains "/issues" excluding user emails ending in @sentry.io and @getsentry.com, environment prod
```

For "alerts":

```
replays from the last 24 hours where url contains "/alerts" excluding user emails ending in @sentry.io and @getsentry.com, environment prod
```

For "insights":

```
replays from the last 24 hours where url contains "/insights" excluding user emails ending in @sentry.io and @getsentry.com, environment prod
```

## Combining Areas

Some research questions span multiple areas. Combine by running separate queries:

- "Issue triage workflow" = issues + alerts + issue-details
- "Performance debugging" = performance + insights + profiling
- "Release management" = releases + dashboards
- "Monitoring workflows" = monitors + alerts + issues
