## Set Up Sentry for This Application

Follow the installed Sentry getting started and instrumentation skills to inspect
this repository, configure the SDK, and verify that Sentry receives a test event.

Your private onboarding run code is `{{ code }}`. Use it to report progress to the
onboarding page. Send updates with the authenticated CLI. If you use an existing Sentry
MCP connection instead, send the same updates with the `onboarding_status_update` tool,
using this run code and the organization slug above. The tool records the connection
method itself, so leave out `extra` on `connect_agent`.

Once Sentry access and the account context are confirmed, report that the agent
connected:

```sh
{{ status_command }} -f stage=connect_agent -f status=completed -f 'extra[method]=cli'
```

Then report progress at the boundaries of these stages the same way, changing `stage`
and `status`: `analyze_project`, `create_project`, `instrument_app`, `plan_test_error`,
`send_verification_error`, `receive_verification_error`, `prepare_production`, and
`check_stack_trace_quality`. For example:

```sh
{{ status_command }} -f stage=analyze_project -f status=active
```

Use `active`, `waiting`, `completed`, `skipped`, or `failed` as appropriate.
Only three stages take `extra`: `connect_agent` with `-f 'extra[method]=cli'`,
`create_project` with `-f 'extra[projectSlugs][]=<slug>'`, and
`receive_verification_error` with `-f 'extra[issueIds][]=<id>'`. Repeat the field for
each slug or ID. Add `-f runStatus=completed` to the update that completes or skips
`check_stack_trace_quality`. A failed stage requires a brief `-f 'eventNote=<note>'`;
add `-f runStatus=failed` to it only when setup cannot continue. Keep notes free of
apostrophes, credentials, source code, file paths, and sensitive command output.
Stop sending updates when a reply has `"continueUpdates": false` or a call fails with
404, 409, or 410. If a call fails with 400, fix the fields the error names and retry
once. Continue setup if progress reporting is unavailable.

Finish by summarizing the changes, the Sentry project, and verification results.
