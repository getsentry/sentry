from __future__ import annotations

import logging
from datetime import datetime, timezone

import sentry_sdk
from django.db.models import F
from django.utils import timezone as django_timezone

from sentry import analytics
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
    project_created,
    project_transferred,
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


@project_created.connect(weak=False, dispatch_uid="record_new_project")
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
    )

    _, created = OrganizationOnboardingTask.objects.update_or_create(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_PROJECT,
        defaults={
            "user_id": user_id,
            "status": OnboardingTaskStatus.COMPLETE,
            "project_id": project.id,
        },
    )
    # if we updated the task "first project", it means that it already exists and now we want to create the task "second platform"
    if not created:
        OrganizationOnboardingTask.objects.update_or_create(
            organization_id=project.organization_id,
            task=OnboardingTask.SECOND_PLATFORM,
            defaults={
                "user_id": user_id,
                "status": OnboardingTaskStatus.COMPLETE,
                "project_id": project.id,
            },
        )
        analytics.record(
            "second_platform.added",
            user_id=default_user_id,
            organization_id=project.organization_id,
            project_id=project.id,
        )


@first_event_received.connect(weak=False, dispatch_uid="onboarding.record_first_event")
def record_first_event(project, event, **kwargs):
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

    org_has_first_event_task = OrganizationOnboardingTask.objects.filter(
        organization_id=project.organization_id, task=OnboardingTask.FIRST_EVENT
    ).first()

    if org_has_first_event_task:
        # We don't need to record a first event for every project.
        # Once a user sends their first event, we assume they've learned the process
        # and completed the quick start task.
        return

    _, created = OrganizationOnboardingTask.objects.get_or_create(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_EVENT,
        defaults={
            "status": OnboardingTaskStatus.COMPLETE,
            "project_id": project.id,
        },
    )

    if created:
        analytics.record(
            "first_event.sent",
            user_id=user.id if user else None,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event.platform,
            project_platform=project.platform,
        )


@first_transaction_received.connect(weak=False, dispatch_uid="onboarding.record_first_transaction")
def _record_first_transaction(project, event, **kwargs):
    return record_first_transaction(project, event.datetime, **kwargs)


def record_first_transaction(project, datetime, **kwargs):
    if project.flags.has_transactions:
        return

    project.update(flags=F("flags").bitor(Project.flags.has_transactions))

    OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_TRANSACTION,
        status=OnboardingTaskStatus.COMPLETE,
        date_completed=datetime,
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


@first_profile_received.connect(weak=False, dispatch_uid="onboarding.record_first_profile")
def record_first_profile(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_profiles))

    analytics.record(
        "first_profile.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_replay_received.connect(weak=False, dispatch_uid="onboarding.record_first_replay")
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


@first_flag_received.connect(weak=False, dispatch_uid="onboarding.record_first_flag")
def record_first_flag(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_flags))

    analytics.record(
        "first_flag.sent",
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_feedback_received.connect(weak=False, dispatch_uid="onboarding.record_first_feedback")
def record_first_feedback(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_feedbacks))

    analytics.record(
        "first_feedback.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_new_feedback_received.connect(
    weak=False, dispatch_uid="onboarding.record_first_new_feedback"
)
def record_first_new_feedback(project, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_new_feedbacks))

    analytics.record(
        "first_new_feedback.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )


@first_cron_monitor_created.connect(weak=False, dispatch_uid="onboarding.record_first_cron_monitor")
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


@cron_monitor_created.connect(weak=False, dispatch_uid="onboarding.record_cron_monitor_created")
def record_cron_monitor_created(project, user, from_upsert, **kwargs):
    analytics.record(
        "cron_monitor.created",
        user_id=user.id if user else project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        from_upsert=from_upsert,
    )


@first_cron_checkin_received.connect(
    weak=False, dispatch_uid="onboarding.record_first_cron_checkin"
)
def record_first_cron_checkin(project, monitor_id, **kwargs):
    project.update(flags=F("flags").bitor(Project.flags.has_cron_checkins))

    analytics.record(
        "first_cron_checkin.sent",
        user_id=project.organization.default_owner_id,
        organization_id=project.organization_id,
        project_id=project.id,
        monitor_id=monitor_id,
    )


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


first_insight_span_received.connect(record_first_insight_span, weak=False)


# TODO (mifu67): update this to use the new org member invite model
@member_invited.connect(weak=False, dispatch_uid="onboarding.record_member_invited")
def record_member_invited(member, user, **kwargs):
    OrganizationOnboardingTask.objects.get_or_create(
        organization_id=member.organization_id,
        task=OnboardingTask.INVITE_MEMBER,
        defaults={
            "status": OnboardingTaskStatus.COMPLETE,
        },
    )

    analytics.record(
        "member.invited",
        invited_member_id=member.id,
        inviter_user_id=user.id if user else None,
        organization_id=member.organization_id,
        referrer=kwargs.get("referrer"),
    )


def _record_release_received(project, event, **kwargs):
    return record_release_received(project, event.data.get("release"), **kwargs)


def record_release_received(project, release, **kwargs):
    if not release:
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


event_processed.connect(_record_release_received, weak=False)
transaction_processed.connect(_record_release_received, weak=False)


@first_event_with_minified_stack_trace_received.connect(
    weak=False, dispatch_uid="onboarding.record_event_with_first_minified_stack_trace_for_project"
)
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


@event_processed.connect(weak=False, dispatch_uid="onboarding.record_sourcemaps_received")
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


@event_processed.connect(
    weak=False, dispatch_uid="onboarding.record_sourcemaps_received_for_project"
)
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


@alert_rule_created.connect(weak=False, dispatch_uid="onboarding.record_alert_rule_created")
def record_alert_rule_created(user, project: Project, rule_type: str, **kwargs):
    # The quick start now only has a task for issue alert rules.
    # Please see https://github.com/getsentry/sentry/blob/c06a3aa5fb104406f2a44994d32983e99bc2a479/static/app/components/onboardingWizard/taskConfig.tsx#L351-L352
    if rule_type == "metric":
        return
    OrganizationOnboardingTask.objects.update_or_create(
        organization_id=project.organization_id,
        task=OnboardingTask.ALERT_RULE,
        defaults={
            "status": OnboardingTaskStatus.COMPLETE,
            "user_id": user.id if user else None,
            "project_id": project.id,
            "date_completed": django_timezone.now(),
        },
    )


@integration_added.connect(weak=False, dispatch_uid="onboarding.record_integration_added")
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


@project_transferred.connect(weak=False, dispatch_uid="onboarding.record_project_transferred")
def record_project_transferred(old_org_id: int, updated_project: Project, **kwargs):

    new_organization_id = updated_project.organization_id

    analytics.record(
        "project.transferred",
        old_organization_id=old_org_id,
        new_organization_id=new_organization_id,
        project_id=updated_project.id,
        platform=updated_project.platform,
    )

    existing_tasks_in_old_org = OrganizationOnboardingTask.objects.filter(
        organization_id=old_org_id,
        task__in=OrganizationOnboardingTask.TRANSFERABLE_TASKS,
    )

    existing_tasks_in_new_org = set(
        OrganizationOnboardingTask.objects.filter(organization_id=new_organization_id).values_list(
            "task", flat=True
        )
    )

    tasks_to_be_transferred = []

    new_tasks = [task for task in existing_tasks_old_org if task.task not in existing_tasks_in_new_org]
    for task in new_tasks:
        copied_task = copy.deepcopy(task)
        copied_task.pk = None
        copied_task.org = new_organization_id
        copied_task.save()
            new_task = OrganizationOnboardingTask(**task_dict)
            new_task.organization_id = new_organization_id
            tasks_to_be_transferred.append(new_task)

    if tasks_to_be_transferred:
        OrganizationOnboardingTask.objects.bulk_create(tasks_to_be_transferred)
