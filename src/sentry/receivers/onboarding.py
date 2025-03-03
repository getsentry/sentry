from __future__ import annotations

import logging
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.utils import timezone as django_timezone

from sentry import analytics, features
from sentry.constants import InsightModules
from sentry.integrations.base import IntegrationDomain, get_integration_types
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.organization import Organization
from sentry.models.organizationonboardingtask import (
    OnboardingTask,
    OnboardingTaskStatus,
    OrganizationOnboardingTask,
)
from sentry.models.project import Project
from sentry.signals import (
    alert_rule_created,
    cron_monitor_created,
    event_processed,
    first_cron_checkin_received,
    first_cron_monitor_created,
    first_event_received,
    first_event_with_minified_stack_trace_received,
    first_feedback_received,
    first_flag_received,
    first_insight_span_received,
    first_new_feedback_received,
    first_profile_received,
    first_replay_received,
    first_transaction_received,
    integration_added,
    member_invited,
    member_joined,
    project_created,
    transaction_processed,
)
from sentry.users.services.user import RpcUser
from sentry.utils.event import has_event_minified_stack_trace
from sentry.utils.javascript import has_sourcemap
from sentry.utils.safe import get_path

logger = logging.getLogger("sentry")

# Used to determine if we should or not record an analytic data
# for a first event of a project with a minified stack trace
START_DATE_TRACKING_FIRST_EVENT_WITH_MINIFIED_STACK_TRACE_PER_PROJ = datetime(
    2022, 12, 14, tzinfo=timezone.utc
)
# Used to determine if we should or not record an analytic data
# for a first sourcemap of a project
START_DATE_TRACKING_FIRST_SOURCEMAP_PER_PROJ = datetime(2023, 11, 16, tzinfo=timezone.utc)


@project_created.connect(weak=False)
def record_new_project(project, user=None, user_id=None, origin=None, **kwargs):

    scope = sentry_sdk.get_current_scope()
    scope.set_extra("project_id", project.id)
    scope.set_extra("source", "record_new_project")

    if user_id is not None:
        default_user_id = user_id
    elif user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        try:
            default_user = Organization.objects.get(id=project.organization_id).get_default_owner()
            default_user_id = default_user.id
        except IndexError:
            logger.warning(
                "Cannot initiate onboarding for organization (%s) due to missing owners",
                project.organization_id,
            )
            sentry_sdk.capture_message(
                f"Cannot initiate onboarding for organization ({project.organization_id}) due to missing owners",
                level="warning",
            )
            # XXX(dcramer): we cannot setup onboarding tasks without a user
            return

    analytics.record(
        "project.created",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        origin=origin,
        project_id=project.id,
        platform=project.platform,
        updated_empty_state=features.has(
            "organizations:issue-stream-empty-state", project.organization
        ),
    )

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_PROJECT,
        user_id=user_id,
        status=OnboardingTaskStatus.COMPLETE,
        project_id=project.id,
    )
    if not success:
        # Check if the "first project" task already exists and log an error if needed
        first_project_task_exists = OrganizationOnboardingTask.objects.filter(
            organization_id=project.organization_id, task=OnboardingTask.FIRST_PROJECT
        ).exists()

        if not first_project_task_exists:
            sentry_sdk.capture_message(
                f"An error occurred while trying to record the first project for organization ({project.organization_id})",
                level="warning",
            )

        OrganizationOnboardingTask.objects.record(
            organization_id=project.organization_id,
            task=OnboardingTask.SECOND_PLATFORM,
            user_id=user_id,
            status=OnboardingTaskStatus.COMPLETE,
            project_id=project.id,
        )
        analytics.record(
            "second_platform.added",
            user_id=default_user_id,
            organization_id=project.organization_id,
            project_id=project.id,
        )


@first_event_received.connect(weak=False)
def record_first_event(project, event, **kwargs):
    """
    Requires up to 2 database calls, but should only run with the first event in
    any project, so performance should not be a huge bottleneck.
    """
    # If complete, pass (creation fails due to organization, task unique constraint)
    # If pending, update.
    # If does not exist, create.
    rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_EVENT,
        status=OnboardingTaskStatus.PENDING,
        values={
            "status": OnboardingTaskStatus.COMPLETE,
            "project_id": project.id,
            "date_completed": project.first_event,
            "data": {"platform": event.platform},
        },
    )

    try:
        user: RpcUser = Organization.objects.get_from_cache(
            id=project.organization_id
        ).get_default_owner()
    except IndexError:
        logger.warning(
            "Cannot record first event for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    # this event fires once per project
    analytics.record(
        "first_event_for_project.sent",
        user_id=user.id if user else None,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=event.platform,
        project_platform=project.platform,
        url=dict(event.tags).get("url", None),
        has_minified_stack_trace=has_event_minified_stack_trace(event),
        sdk_name=get_path(event, "sdk", "name"),
    )

    if rows_affected or created:
        # this event only fires once per org
        analytics.record(
            "first_event.sent",
            user_id=user.id if user else None,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event.platform,
            project_platform=project.platform,
        )
        return

    try:
        oot = OrganizationOnboardingTask.objects.filter(
            organization_id=project.organization_id, task=OnboardingTask.FIRST_EVENT
        )[0]
    except IndexError:
        return

    # Only counts if it's a new project
    if oot.project_id != project.id:
        rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
            organization_id=project.organization_id,
            task=OnboardingTask.SECOND_PLATFORM,
            status=OnboardingTaskStatus.PENDING,
            values={
                "status": OnboardingTaskStatus.COMPLETE,
                "project_id": project.id,
                "date_completed": project.first_event,
                "data": {"platform": event.platform},
            },
        )
        if rows_affected or created:
            analytics.record(
                "second_platform.added",
                user_id=user.id if user else None,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
            )


@first_transaction_received.connect(weak=False)
def record_first_transaction(project, event, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_transactions))

    OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_TRANSACTION,
        status=OnboardingTaskStatus.COMPLETE,
        date_completed=event.datetime,
    )

    try:
        default_user_id = project.organization.get_default_owner().id
    except IndexError:
        default_user_id = None

    analytics.record(
        "first_transaction.sent",
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_profile_received.connect(weak=False)
def record_first_profile(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_profiles))

    analytics.record(
        "first_profile.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_replay_received.connect(weak=False)
def record_first_replay(project, **kwargs):
    logger.info("record_first_replay_start")
    project.update(flags=F("flags").bitor(Project.flags.has_replays))

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.SESSION_REPLAY,
        status=OnboardingTaskStatus.COMPLETE,
        date_completed=django_timezone.now(),
    )
    logger.info("record_first_replay_onboard_task", extra={"success": success})

    if success:
        logger.info("record_first_replay_analytics_start")
        analytics.record(
            "first_replay.sent",
            user_id=project.organization.default_owner_id,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
        logger.info("record_first_replay_analytics_end")


@first_flag_received.connect(weak=False)
def record_first_flag(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_flags))

    analytics.record(
        "first_flag.sent",
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_feedback_received.connect(weak=False)
def record_first_feedback(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_feedbacks))

    analytics.record(
        "first_feedback.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_new_feedback_received.connect(weak=False)
def record_first_new_feedback(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_new_feedbacks))

    analytics.record(
        "first_new_feedback.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_cron_monitor_created.connect(weak=False)
def record_first_cron_monitor(project, user, from_upsert, **kwargs):
    updated = project.update(flags=F("flags").bitor(Project.flags.has_cron_monitors))

    if updated:
        analytics.record(
            "first_cron_monitor.created",
            user_id=user.id if user else project.organization.default_owner_id,
            organization_id=project.organization_id,
            project_id=project.id,
            from_upsert=from_upsert,
        )


@cron_monitor_created.connect(weak=False)
def record_cron_monitor_created(project, user, from_upsert, **kwargs):
    analytics.record(
        "cron_monitor.created",
        user_id=user.id if user else project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        from_upsert=from_upsert,
    )


@first_cron_checkin_received.connect(weak=False)
def record_first_cron_checkin(project, monitor_id, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_cron_checkins))

    analytics.record(
        "first_cron_checkin.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        monitor_id=monitor_id,
    )


@first_insight_span_received.connect(weak=False)
def record_first_insight_span(project, module, **kwargs):
    flag = None
    if module == InsightModules.HTTP:
        flag = Project.flags.has_insights_http
    elif module == InsightModules.DB:
        flag = Project.flags.has_insights_db
    elif module == InsightModules.ASSETS:
        flag = Project.flags.has_insights_assets
    elif module == InsightModules.APP_START:
        flag = Project.flags.has_insights_app_start
    elif module == InsightModules.SCREEN_LOAD:
        flag = Project.flags.has_insights_screen_load
    elif module == InsightModules.VITAL:
        flag = Project.flags.has_insights_vitals
    elif module == InsightModules.CACHE:
        flag = Project.flags.has_insights_caches
    elif module == InsightModules.QUEUE:
        flag = Project.flags.has_insights_queues
    elif module == InsightModules.LLM_MONITORING:
        flag = Project.flags.has_insights_llm_monitoring

    if flag is not None:
        project.update(flags=F("flags").bitor(flag))

    analytics.record(
        "first_insight_span.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
        module=module,
    )


@member_invited.connect(weak=False)
def record_member_invited(member, user, **kwargs):
    OrganizationOnboardingTask.objects.record(
        organization_id=member.organization_id,
        task=OnboardingTask.INVITE_MEMBER,
        user_id=user.id if user else None,
        status=OnboardingTaskStatus.PENDING,
        data={"invited_member_id": member.id},
    )

    analytics.record(
        "member.invited",
        invited_member_id=member.id,
        inviter_user_id=user.id if user else None,
        organization_id=member.organization_id,
        referrer=kwargs.get("referrer"),
    )


@member_joined.connect(weak=False)
def record_member_joined(organization_id: int, organization_member_id: int, **kwargs):
    OrganizationOnboardingTask.objects.create_or_update(
        organization_id=organization_id,
        task=OnboardingTask.INVITE_MEMBER,
        status=OnboardingTaskStatus.PENDING,
        values={
            "status": OnboardingTaskStatus.COMPLETE,
            "date_completed": django_timezone.now(),
            "data": {"invited_member_id": organization_member_id},
        },
    )


def record_release_received(project, event, **kwargs):
    if not event.data.get("release"):
        return

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.RELEASE_TRACKING,
        status=OnboardingTaskStatus.COMPLETE,
        project_id=project.id,
    )
    if success:
        organization = Organization.objects.get_from_cache(id=project.organization_id)
        try:
            owner: RpcUser = organization.get_default_owner()
        except IndexError:
            logger.warning(
                "Cannot record release received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return

        analytics.record(
            "first_release_tag.sent",
            user_id=owner.id,
            project_id=project.id,
            organization_id=project.organization_id,
        )


event_processed.connect(record_release_received, weak=False)
transaction_processed.connect(record_release_received, weak=False)


@first_event_with_minified_stack_trace_received.connect(weak=False)
def record_event_with_first_minified_stack_trace_for_project(project, event, **kwargs):
    organization = Organization.objects.get_from_cache(id=project.organization_id)
    owner_id = organization.default_owner_id
    if not owner_id:
        logger.warning(
            "Cannot record first event for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    # First, only enter this logic if we've never seen a minified stack trace before
    if not project.flags.has_minified_stack_trace:
        # Next, attempt to update the flag, but ONLY if the flag is currently not set.
        # The number of affected rows tells us whether we succeeded or not. If we didn't, then skip sending the event.
        # This guarantees us that this analytics event will only be ever sent once.
        affected = Project.objects.filter(
            id=project.id, flags=F("flags").bitand(~Project.flags.has_minified_stack_trace)
        ).update(flags=F("flags").bitor(Project.flags.has_minified_stack_trace))

        if (
            project.date_added > START_DATE_TRACKING_FIRST_EVENT_WITH_MINIFIED_STACK_TRACE_PER_PROJ
            and affected > 0
        ):
            analytics.record(
                "first_event_with_minified_stack_trace_for_project.sent",
                user_id=owner_id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform=project.platform,
                url=dict(event.tags).get("url", None),
            )


@event_processed.connect(weak=False)
def record_sourcemaps_received(project, event, **kwargs):
    if not has_sourcemap(event):
        return

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.SOURCEMAPS,
        status=OnboardingTaskStatus.COMPLETE,
        project_id=project.id,
    )
    if success:
        organization = Organization.objects.get_from_cache(id=project.organization_id)
        try:
            owner: RpcUser = organization.get_default_owner()
        except IndexError:
            logger.warning(
                "Cannot record sourcemaps received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return
        analytics.record(
            "first_sourcemaps.sent",
            user_id=owner.id,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event.platform,
            project_platform=project.platform,
            url=dict(event.tags).get("url", None),
        )


@event_processed.connect(weak=False)
def record_sourcemaps_received_for_project(project, event, **kwargs):
    if not has_sourcemap(event):
        return

    organization = Organization.objects.get_from_cache(id=project.organization_id)
    owner_id = organization.default_owner_id
    if not owner_id:
        logger.warning(
            "Cannot record sourcemaps received for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    # First, only enter this logic if we've never seen a minified stack trace before
    if not project.flags.has_sourcemaps:
        # Next, attempt to update the flag, but ONLY if the flag is currently not set.
        # The number of affected rows tells us whether we succeeded or not. If we didn't, then skip sending the event.
        # This guarantees us that this analytics event will only be ever sent once.
        affected = Project.objects.filter(
            id=project.id, flags=F("flags").bitand(~Project.flags.has_sourcemaps)
        ).update(flags=F("flags").bitor(Project.flags.has_sourcemaps))

        if project.date_added > START_DATE_TRACKING_FIRST_SOURCEMAP_PER_PROJ and affected > 0:
            analytics.record(
                "first_sourcemaps_for_project.sent",
                user_id=owner_id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform=project.platform,
                url=dict(event.tags).get("url", None),
            )


@alert_rule_created.connect(weak=False)
def record_alert_rule_created(user, project: Project, rule_type: str, **kwargs):
    # The quick start now only has a task for issue alert rules.
    # Please see https://github.com/getsentry/sentry/blob/c06a3aa5fb104406f2a44994d32983e99bc2a479/static/app/components/onboardingWizard/taskConfig.tsx#L351-L352
    if rule_type == "metric":
        return
    OrganizationOnboardingTask.objects.create_or_update(
        organization_id=project.organization_id,
        task=OnboardingTask.ALERT_RULE,
        values={
            "status": OnboardingTaskStatus.COMPLETE,
            "user_id": user.id if user else None,
            "project_id": project.id,
            "date_completed": django_timezone.now(),
        },
    )


@integration_added.connect(weak=False)
def record_integration_added(
    integration_id: int, organization_id: int, user_id: int | None, **kwargs
):
    integration: RpcIntegration | None = integration_service.get_integration(
        integration_id=integration_id
    )
    if integration is None:
        return

    integration_types = get_integration_types(integration.provider)

    task_mapping = {
        IntegrationDomain.SOURCE_CODE_MANAGEMENT: OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE,
        IntegrationDomain.MESSAGING: OnboardingTask.REAL_TIME_NOTIFICATIONS,
    }

    for integration_type in integration_types:
        if integration_type in task_mapping:
            completed_integration = OrganizationOnboardingTask.objects.filter(
                organization_id=organization_id,
                task=task_mapping[integration_type],
                status=OnboardingTaskStatus.COMPLETE,
            )
            if not completed_integration.exists():
                OrganizationOnboardingTask.objects.create(
                    organization_id=organization_id,
                    task=task_mapping[integration_type],
                    status=OnboardingTaskStatus.COMPLETE,
                )
