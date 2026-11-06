## Set Up Sentry for This Application

Follow the installed Sentry getting started and instrumentation skills to inspect
this repository, configure the SDK, and verify that Sentry receives a test event.

Your private onboarding run code is `{{ code }}`. Use it to report progress to the
onboarding page. Send updates with the authenticated CLI:

```sh
sentry api organizations/{{ organization_id }}/onboarding/agent/status/ -X POST -F schemaVersion=1 -f 'runToken={{ code }}' -f stage=analyze_project -f status=active
```

Report progress at the boundaries of these stages: `analyze_project`,
`create_project`, `instrument_app`, `plan_test_error`, `send_verification_error`,
`receive_verification_error`, `prepare_production`, and `check_stack_trace_quality`.
Use `active`, `waiting`, `completed`, `skipped`, or `failed` as appropriate.
Include `runStatus: "completed"` only when the final stage succeeds.
A failed stage requires a brief `eventNote`; use `runStatus: "failed"` only when
setup cannot continue. Keep notes free of credentials, source code, file paths,
and sensitive command output. Continue setup if progress reporting is unavailable.

Finish by summarizing the changes, the Sentry project, and verification results.
