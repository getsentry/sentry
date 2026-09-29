# Row locks (SELECT ... FOR UPDATE) on Control silo tables that tests are allowed
# to take, keyed by (table, call site). The call site is the module and qualified
# name of the first function outside Django and Sentry's db/silo plumbing.
#
# Control tables are shared by every organization and many are written heavily.
# INC-2480 was a new select_for_update on sentry_organizationintegration that
# queued writes behind it until the Control database stalled. Before adding an
# entry, check how often the locked rows are written and what else waits on them.
# Prefer an atomic conditional UPDATE (compare-and-swap) where it will do.
#
# Changes to this file need review from the owners in .github/CODEOWNERS.
ALLOWED_CONTROL_ROW_LOCKS: dict[tuple[str, str], str] = {
    (
        "sentry_controloutbox",
        "sentry.hybridcloud.models.outbox.OutboxBase.prepare_next_from_shard",
    ): "Claims the next outbox shard with NOWAIT so only one worker drains it.",
    (
        "sentry_controloutbox",
        "sentry.hybridcloud.models.outbox.OutboxBase.process_shard",
    ): "Holds the shard's messages while they are processed so they are not drained twice.",
    (
        "hybridcloud_controlcacheversion",
        "sentry.hybridcloud.models.cacheversion.CacheVersionBase.incr_version",
    ): "Serializes increments of a single cache version key.",
    (
        "sentry_organizationintegration",
        "sentry.integrations.pagerduty.utils.add_service",
    ): "Existing before CTRL-63; not yet reviewed for load.",
    (
        "sentry_organizationmapping",
        "sentry.integrations.api.endpoints.organization_integration_direct_enable.OrganizationIntegrationDirectEnableEndpoint.post",
    ): "Existing before CTRL-63; not yet reviewed for load.",
    (
        "sentry_organizationmapping",
        "sentry.hybridcloud.services.organization_mapping.impl.DatabaseBackedOrganizationMappingService.upsert",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_projectkeymapping",
        "sentry.hybridcloud.services.replica.impl.DatabaseBackedControlReplicaService.upsert_project_key_mapping",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_userip",
        "sentry.audit_log.services.log.impl.DatabaseBackedLogService.record_user_ip",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_lostpasswordhash",
        "sentry.api.endpoints.auth_recovery.AuthRecoveryConfirmEndpoint.post",
    ): "Existing before CTRL-63; not yet reviewed for load.",
    (
        "sentry_controloption",
        "sentry.options.store.OptionsStore.set_store",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_scheduleddeletion",
        "sentry.deletions.models.scheduleddeletion.BaseScheduledDeletion.schedule",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_organizationavatarreplica",
        "sentry.hybridcloud.services.replica.impl.DatabaseBackedControlReplicaService.upsert_organization_avatar_replica",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "hybridcloud_controloutboxbackfillwatermark",
        "sentry.hybridcloud.tasks.backfill_outboxes._write_processing_state",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_controldeletionwatermark",
        "sentry.deletions.tasks.hybrid_cloud._write_watermark",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_notificationsettingprovider",
        "sentry.notifications.services.impl.DatabaseBackedNotificationsService.enable_all_settings_for_provider",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_notificationsettingprovider",
        "sentry.notifications.api.endpoints.user_notification_settings_providers.UserNotificationSettingsProvidersEndpoint.put",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_notificationsettingoption",
        "sentry.notifications.services.impl.DatabaseBackedNotificationsService.update_notification_options",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "sentry_notificationsettingoption",
        "sentry.notifications.api.endpoints.user_notification_settings_options.UserNotificationSettingsOptionsEndpoint.put",
    ): "Existing before CTRL-63 (implicit, via update_or_create); not yet reviewed for load.",
    (
        "auth_user",
        "sentry.api.endpoints.auth_recovery.AuthRecoveryConfirmEndpoint.post",
    ): "Existing before CTRL-63; not yet reviewed for load.",
}
