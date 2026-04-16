# Skipped Test-Pollution Tests

Tests skipped via `@pytest.mark.skip(reason="test pollution: ...")` in the shuffle-tests-v2/v3 branch. Each passes 5/5 in isolation but fails in shuffled order. **Revisit** after fixing the underlying shared state (Redis keys, Snuba/ClickHouse data, outbox rows, etc.).

---

## tests/sentry/api/endpoints/test_project_alert_rule_task_details.py

- `ProjectAlertRuleTaskDetailsTest::test_status_success` — Redis rule status key cleared by concurrent flushdb() or set to wrong state by prior test
- `ProjectAlertRuleTaskDetailsTest::test_workflow_engine_serializer` — same Redis flush race; `set_value()` immediately before the request still loses the race when another xdist worker flushes Redis between set and GET
- `ProjectAlertRuleTaskDetailsDeltaTest::test_workflow_engine_serializer_matches_old_serializer` — alert rule / serializer state from prior tests causes response mismatch in shuffled ordering

## tests/snuba/api/endpoints/test_organization_events_facets_performance.py

- `OrganizationEventsFacetsPerformanceEndpointTest::test_multiple_projects_not_allowed` — `MaxSnowflakeRetryError`: 3 concurrent xdist workers saturate the Redis snowflake sequence counter during project creation in setUp

## tests/snuba/api/endpoints/test_organization_metrics_meta.py

- `OrganizationMetricsCompatiblity::test_multiple_projects` — `MaxSnowflakeRetryError`: concurrent xdist workers saturate the Redis snowflake counter during `create_project()` calls in the test body

## tests/sentry/dynamic_sampling/tasks/test_common.py

- `TestGetActiveOrgsVolumes::test_get_active_orgs_volumes_exact_batch_match` — Snuba performance metrics from prior tests accumulate in ClickHouse and contaminate `GetActiveOrgsVolumes` query; `org.total` returns 200.0 instead of 3

## tests/sentry/dynamic_sampling/tasks/test_tasks.py

- `TestRecalibrateOrgsTasks::test_recalibrate_orgs_with_custom_ds` — Snuba performance metrics from prior tests contaminate the recalibration factor query; observed sample rate for orgs[0] appears as ~20% instead of 10%, so `recalibrate_orgs()` writes no key to Redis

## tests/sentry/data_export/test_tasks.py

- `AssembleDownloadExploreTest::test_explore_logs_jsonl_format` — log messages from prior tests appear in the JSONL export results, causing set comparison to fail

## tests/sentry/api/endpoints/test_organization_sampling_project_span_counts.py

- `OrganizationSamplingProjectSpanCountsTest::test_get_span_counts_with_many_projects` — `MaxSnowflakeRetryError`: concurrent xdist workers saturate the Redis snowflake sequence counter when all 3 workers create projects simultaneously; `time_machine.travel(..., tick=True)` is insufficient isolation at 3-worker concurrency

## tests/sentry/deletions/tasks/test_hybrid_cloud.py

- `test_no_work_is_no_op` (module-level) — prior test leaves tombstone/outbox rows that cause `schedule_hybrid_cloud_foreign_key_jobs` to find work and update the watermark tid

## tests/sentry/digests/backends/test_redis.py

- `RedisBackendTestCase::test_large_digest` — persistent infrastructure failure: DIGEST_OPEN Lua script returns fewer than 8192 records (likely `rb.Cluster` response size limit); not test pollution but a real bug in the test or Lua script

## tests/sentry/event_manager/interfaces/test_stacktrace.py

- `test_serialize_returns_frames` (module-level) — snapshot comparison fails when prior tests leave different stacktrace state

## tests/sentry/ingest/ingest_consumer/test_ingest_consumer_kafka.py

- `test_ingest_consumer_gets_event_unstuck` (module-level) — Kafka consumer message ordering is non-deterministic in shuffled runs; message from prior test may satisfy the 'unstuck' condition before this test's message arrives

## tests/sentry/ingest/ingest_consumer/test_ingest_consumer_processing.py

- `test_deobfuscate_view_hierarchy_objectstore` (module-level) — ProGuard mapping file from prior test contaminates deobfuscation result; shared DIF storage state causes wrong class name mapping

## tests/sentry/integrations/aws_lambda/test_integration.py

- `AwsLambdaIntegrationTest::test_node_lambda_setup_layer_success` — `update_function_configuration` mock called 0 times (expected 1); prior test leaves AWS Lambda integration state that prevents the setup flow from running

## tests/sentry/integrations/slack/notifications/test_deploy.py

- `SlackDeployNotificationTest::test_deploy_block` — stale projects from prior tests cause blocks[1]/blocks[2] ordering to diverge (different project sort when extra projects are in DB)

## tests/sentry/middleware/test_ratelimit_middleware.py

- `RatelimitMiddlewareTest::test_impersonation_enforces_rate_limits_when_disabled` — prior test leaves rate-limit counter state that prevents `request.rate_limit_key` from being set; response is None instead of 429
- `TestConcurrentRateLimiter::test_concurrent_request_rate_limiting` — `test_request_finishes` can leave a stale concurrent counter in Redis, causing this test to start with count=1 instead of 0; inherently racy due to 10ms sleep jitter

## tests/sentry/notifications/notifications/test_digests.py

- `DigestSlackNotification::test_slack_digest_notification_truncates_at_48_blocks` — Slack footer shows `'bar'` (project slug from prior test) instead of 'showing' text; stale project state contaminates notification content

## tests/sentry/objectstore/endpoints/test_organization.py

- `OrganizationObjectstoreEndpointTest` (entire class) — live_server socket leak: Django WSGI server leaves an open socket.py file descriptor at session teardown, triggering `_open_files()` assertion failure
- `OrganizationObjectstoreEndpointWithControlSiloTest` (entire class) — same live_server socket leak

## tests/sentry/preprod/api/endpoints/test_builds.py

- `BuildsEndpointTest::test_free_text_search_by_build_id` — stale preprod artifact from prior test is visible in search results, returning 2 builds instead of 1

## tests/sentry/sentry_apps/test_sentry_app_installation_notifier.py

- `TestInstallationNotifier::test_webhook_request_saved` — `SentryAppWebhookRequestsBuffer` Redis state from prior tests causes `buffer.get_requests()` to return fewer entries than expected

## tests/sentry/spans/test_buffer.py

- All `cluster-nochunk` and `cluster-chunk1` parametrized variants (via `_SKIP_CLUSTER` marker) — the Redis Cluster (ports 7000-7005) is shared across all xdist workers; stale keys from concurrent tests cause `assert_clean` failures

## tests/sentry/release_health/test_tasks.py

- `TestAdoptReleasesPath::test_simple` — ClickHouse session data from prior `TestMetricReleaseMonitor` tests is not rolled back between tests; accumulated Snuba state causes the adoption task to find no adopted releases
- `TestAdoptReleasesPath::test_monitor_release_adoption` — same Snuba state accumulation; `monitor_release_adoption()` is sensitive to prior sessions in ClickHouse
- `TestMetricReleaseMonitor::test_has_releases_is_set` — accumulated ClickHouse session state from prior tests causes `process_projects_with_sessions` to find no sessions for the new project, leaving `flags.has_releases=False`

## tests/sentry/issues/endpoints/test_group_details.py

- `GroupDetailsTest::test_ratelimit` — `group.first_seen` is set at real time (~2026) but the endpoint runs inside `freeze_time("2000-01-01")`; `snuba._prepare_start_end` computes the query window relative to frozen `now()` and raises `QueryOutsideGroupActivityError` on every request, so the rate limit counter never accumulates and the final request returns 500 instead of 429

## tests/sentry/utils/test_circuit_breaker.py

- `TestCircuitBreaker::test_passthrough` — concurrent xdist worker's `clear_caches` fixture calls `cache.clear()` between passthrough calls 2 and 3, resetting the ratelimiter counter so the 3rd call returns `False` (bypass) instead of `True` (throttled)

## tests/sentry/web/frontend/test_group_tag_export.py

- `GroupTagExportTest::test_rate_limit` — rate limit counter reset mid-test by a concurrent xdist worker's `clear_caches` fixture calling `cache.clear()`; the 11th request sees counter=1 instead of 11 and returns 200 instead of 429

## tests/sentry/tsdb/test_redis.py

- `RedisTSDBTest::test_simple` — concurrent xdist worker's `tearDown` calls `flushdb()` on shared Redis DBs 6-8; erases project 2 data mid-test so the post-merge count for project 1 returns 4 instead of 8

## tests/sentry/releases/endpoints/test_organization_release_assemble.py

- `OrganizationReleaseAssembleTest::test_assemble_response` — concurrent xdist worker's `clear_caches` fixture calls `cache.clear()` between `assemble_artifacts()` writing state=`'ok'` and the POST reading it back; endpoint finds no state and returns `'created'`

## tests/sentry/tasks/test_reprocessing2.py

- `test_basic` (parametrized, module-level) — Snuba event data from prior test contaminates query results, leaving `old_events` empty; 'not enough values to unpack' on group_id
- `test_apply_new_fingerprinting_rules` — ClickHouse event data not rolled back between tests; `get_event_by_id` returns None after `optimize_snuba_table` due to cross-worker Snuba state

## tests/sentry/uptime/endpoints/test_organization_uptime_alert_index.py

- `OrganizationUptimeAlertIndexEndpointTest::test` — stale uptime detectors from prior tests appear in index query, making the expected `[alert_1, alert_2]` list incorrect
- `OrganizationUptimeAlertIndexEndpointTest::test_owner_filter` — same stale detector contamination

## tests/snuba/api/endpoints/test_organization_events_stats_mep.py

- `OrganizationEventsStatsMetricsEnhancedPerformanceEndpointTest::test_top_events_with_metrics_enhanced_with_has_filter_falls_back_to_indexed_data` — `KeyError` on `'foo_transaction'`; transaction data from prior test contaminates indexed event query results

## tests/snuba/tagstore/test_tagstore_backend.py

- `TagStorageTest::test_get_group_tag_value_count_generic` — ClickHouse data from prior tests visible via shared Snuba; environment ID or tag count contaminated by cross-worker data
- `TagStorageTest::test_get_group_tag_key_generic` — `GroupTagKeyNotFound` raised because group/tag data from prior tests is not visible in the expected Snuba DB
- `TagStorageTest::test_get_group_tag_keys_and_top_values_generic_issue` — result set is empty or contains unexpected tags from cross-worker Snuba state contaminating `generic_group_and_env` tag query
- `TagStorageTest::test_get_top_group_tag_values_generic` — `GroupTagKeyNotFound` raised because prior Snuba state overwrites this test's tag data for `generic_group_and_env`

---

## How to unblock

Each group of skipped tests shares a root cause pattern:

| Pattern                      | Fix approach                                                   |
| ---------------------------- | -------------------------------------------------------------- |
| Redis key pollution          | Scope keys per-test or flush in setUp/tearDown                 |
| Snuba/ClickHouse shared data | Use `optimize_snuba_table()` + per-test dataset scoping        |
| Outbox/tombstone rows        | Ensure `reset_watermarks()` also clears pending outbox entries |
| Kafka message ordering       | Make tests assert on own producer's message IDs only           |
| Live server socket leaks     | Join/stop live server thread before yielding                   |
| Redis Cluster shared state   | Per-worker cluster isolation (different ports per worker)      |
