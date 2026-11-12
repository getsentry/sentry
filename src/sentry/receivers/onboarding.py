from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, cast

import sentry_sdk
from django.db.models import F

from sentry import analytics
from sentry.analytics.events.cron_monitor_created import CronMonitorCreated, FirstCronMonitorCreated
from sentry.analytics.events.first_cron_checkin_sent import FirstCronCheckinSent
from sentry.analytics.events.first_event_sent import (
    FirstEventSentEvent,
    FirstEventSentEventWithMinifiedStackTraceForProject,
    FirstEventSentForProjectEvent,
)
from sentry.analytics.events.first_feedback_sent import FirstFeedbackSentEvent
from sentry.analytics.events.first_flag_sent import FirstFlagSentEvent
from sentry.analytics.events.first_insight_span_sent import FirstInsightSpanSentEvent
from sentry.analytics.events.first_log_sent import FirstLogSentEvent
from sentry.analytics.events.first_new_feedback_sent import FirstNewFeedbackSentEvent
from sentry.analytics.events.first_profile_sent import FirstProfileSentEvent
from sentry.analytics.events.first_release_tag_sent import FirstReleaseTagSentEvent
from sentry.analytics.events.first_replay_sent import FirstReplaySentEvent
from sentry.analytics.events.first_sourcemaps_sent import (
    FirstSourcemapsSentEvent,
    FirstSourcemapsSentEventForProject,
)
from sentry.analytics.events.first_trace_metric_sent import FirstTraceMetricSentEvent
from sentry.analytics.events.first_transaction_sent import FirstTransactionSentEvent
from sentry.analytics.events.member_invited import MemberInvitedEvent
from sentry.analytics.events.project_created import ProjectCreatedEvent
from sentry.analytics.events.project_transferred import ProjectTransferredEvent
from sentry.analytics.events.second_platform_added import SecondPlatformAddedEvent
from sentry.auth.principal import acting_user_id, has_user
from sentry.constants import InsightModules
from sentry.integrations.base import IntegrationDomain, get_integration_types
from sentry.integrations.services.integration import RpcIntegration, integration_service
from sentry.models.organization import Organization
from sentry.models.organizationonboardingtask import OnboardingTask
from sentry.models.project import Project
from sentry.onboarding_tasks import (
    complete_onboarding_task,
    has_completed_onboarding_task,
    transfer_onboarding_tasks,
)
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
    first_log_received,
    first_new_feedback_received,
    first_profile_received,
    first_replay_received,
    first_trace_metric_received,
    first_transaction_received,
    integration_added,
    member_invited,
    project_created,
    project_transferred,
    transaction_processed,
)
from sentry.utils.event import has_event_minified_stack_trace
from sentry.utils.javascript import has_sourcemap
from sentry.utils.safe import PathSearchable, get_path

if TYPE_CHECKING:
    from sentry.auth.principal import RequestPrincipal
    from sentry.models.organizationmember import OrganizationMember
    from sentry.services.eventstore.models import Event

logger = logging.getLogger("sentry")

# Used to determine if we should or not record an analytic data
# for a first event of a project with a minified stack trace
START_DATE_TRACKING_FIRST_EVENT_WITH_MINIFIED_STACK_TRACE_PER_PROJ = datetime(
    2022, 12, 14, tzinfo=timezone.utc
)
# Used to determine if we should or not record an analytic data
# for a first sourcemap of a project
START_DATE_TRACKING_FIRST_SOURCEMAP_PER_PROJ = datetime(2023, 11, 16, tzinfo=timezone.utc)


def get_owner_id(project: Project, user: RequestPrincipal | None = None) -> int | None:
    if user is not None and has_user(user):
        return user.id

    # this is either the organizations owners user id or None
    return Organization.objects.get_from_cache(id=project.organization_id).default_owner_id


@project_created.connect(weak=False, dispatch_uid="record_new_project")
def record_new_project(
    project: Project,
    user: RequestPrincipal | None = None,
    user_id: int | None = None,
    origin: str | None = None,
    **kwargs: object,
) -> None:
    scope = sentry_sdk.get_current_scope()
    scope.set_extra("project_id", project.id)
    scope.set_attribute("project_id", project.id)
    scope.set_extra("source", "record_new_project")
    scope.set_attribute("source", "record_new_project")

    default_user_id: int | str | None

    if user_id is not None:
        default_user_id = user_id
    elif user is not None and has_user(user):
        user_id = default_user_id = acting_user_id(user)
    else:
        user_id = default_user_id = get_owner_id(project, user)

    if user_id is None:
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

    try:
        analytics.record(
            ProjectCreatedEvent(
                user_id=user_id,
                default_user_id=default_user_id,
                organization_id=project.organization_id,
                origin=origin,
                project_id=project.id,
                platform=project.platform,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)

    completed = complete_onboarding_task(
        organization=project.organization,
        task=OnboardingTask.FIRST_PROJECT,
        user_id=user_id,
        project_id=project.id,
    )

    # if we updated the task "first project", it means that it already exists and now we want to create the task "second platform"
    if not completed:
        complete_onboarding_task(
            organization=project.organization,
            task=OnboardingTask.SECOND_PLATFORM,
            user_id=user_id,
            project_id=project.id,
        )
        analytics.record(
            SecondPlatformAddedEvent(
                user_id=user_id,
                organization_id=project.organization_id,
                project_id=project.id,
            )
        )


@first_event_received.connect(weak=False, dispatch_uid="onboarding.record_first_event")
def record_first_event(project: Project, event: Event, **kwargs: object) -> None:
    if (owner_id := get_owner_id(project)) is None:
        logger.warning(
            "Cannot record first event for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    analytics.record(
        FirstEventSentForProjectEvent(
            user_id=owner_id,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event.platform,
            project_platform=project.platform,
            url=dict(event.tags).get("url", None),
            has_minified_stack_trace=has_event_minified_stack_trace(event),
            sdk_name=get_path(cast("PathSearchable", event), "sdk", "name"),
        )
    )

    if has_completed_onboarding_task(project.organization, OnboardingTask.FIRST_EVENT):
        # We don't need to record a first event for every project.
        # Once a user sends their first event, we assume they've learned the process
        # and completed the quick start task.
        return

    completed = complete_onboarding_task(
        project.organization, OnboardingTask.FIRST_EVENT, user_id=owner_id, project_id=project.id
    )

    if completed:
        analytics.record(
            FirstEventSentEvent(
                user_id=owner_id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform=project.platform,
            )
        )


@first_transaction_received.connect(weak=False, dispatch_uid="onboarding.record_first_transaction")
def record_first_transaction(project: Project, event: Event, **kwargs: object) -> None:
    complete_onboarding_task(
        organization=project.organization,
        task=OnboardingTask.FIRST_TRANSACTION,
        date_completed=event.datetime,
    )
    analytics.record(
        FirstTransactionSentEvent(
            default_user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
    )


@first_profile_received.connect(weak=False, dispatch_uid="onboarding.record_first_profile")
def record_first_profile(project: Project, **kwargs: object) -> None:
    analytics.record(
        FirstProfileSentEvent(
            user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
    )


@first_replay_received.connect(weak=False, dispatch_uid="onboarding.record_first_replay")
def record_first_replay(project: Project, **kwargs: object) -> None:
    logger.info("record_first_replay_start")
    completed = complete_onboarding_task(
        organization=project.organization,
        task=OnboardingTask.SESSION_REPLAY,
    )
    logger.info("record_first_replay_onboard_task", extra={"success": completed})

    if completed:
        logger.info("record_first_replay_analytics_start")
        analytics.record(
            FirstReplaySentEvent(
                user_id=get_owner_id(project),
                organization_id=project.organization_id,
                project_id=project.id,
                platform=project.platform,
            )
        )
        logger.info("record_first_replay_analytics_end")


@first_flag_received.connect(weak=False, dispatch_uid="onboarding.record_first_flag")
def record_first_flag(project: Project, **kwargs: object) -> None:
    analytics.record(
        FirstFlagSentEvent(
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
    )


@first_feedback_received.connect(weak=False, dispatch_uid="onboarding.record_first_feedback")
def record_first_feedback(project: Project, **kwargs: object) -> None:
    analytics.record(
        FirstFeedbackSentEvent(
            user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
    )


@first_new_feedback_received.connect(
    weak=False, dispatch_uid="onboarding.record_first_new_feedback"
)
def record_first_new_feedback(project: Project, **kwargs: object) -> None:
    try:
        analytics.record(
            FirstNewFeedbackSentEvent(
                user_id=get_owner_id(project),
                organization_id=project.organization_id,
                project_id=project.id,
                platform=project.platform,
            )
        )
    except Exception as e:
        sentry_sdk.capture_exception(e)


@first_cron_monitor_created.connect(weak=False, dispatch_uid="onboarding.record_first_cron_monitor")
def record_first_cron_monitor(
    project: Project, user: RequestPrincipal | None, from_upsert: bool, **kwargs: object
) -> None:
    analytics.record(
        FirstCronMonitorCreated(
            user_id=get_owner_id(project, user),
            organization_id=project.organization_id,
            project_id=project.id,
            from_upsert=from_upsert,
        )
    )


@cron_monitor_created.connect(weak=False, dispatch_uid="onboarding.record_cron_monitor_created")
def record_cron_monitor_created(
    project: Project, user: RequestPrincipal | None, from_upsert: bool, **kwargs: object
) -> None:
    analytics.record(
        CronMonitorCreated(
            user_id=get_owner_id(project, user),
            organization_id=project.organization_id,
            project_id=project.id,
            from_upsert=from_upsert,
        )
    )


@first_cron_checkin_received.connect(
    weak=False, dispatch_uid="onboarding.record_first_cron_checkin"
)
def record_first_cron_checkin(project: Project, monitor_id: str, **kwargs: object) -> None:
    analytics.record(
        FirstCronCheckinSent(
            user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            monitor_id=monitor_id,
        )
    )


@first_insight_span_received.connect(
    weak=False, dispatch_uid="onboarding.record_first_insight_span"
)
def record_first_insight_span(project: Project, module: InsightModules, **kwargs: object) -> None:
    analytics.record(
        FirstInsightSpanSentEvent(
            user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
            module=module.value,
        )
    )


@first_log_received.connect(weak=False, dispatch_uid="onboarding.record_first_log")
def record_first_log(project: Project, **kwargs: object) -> None:
    analytics.record(
        FirstLogSentEvent(
            user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
    )


@first_trace_metric_received.connect(
    weak=False, dispatch_uid="onboarding.record_first_trace_metric"
)
def record_first_trace_metric(project: Project, **kwargs: object) -> None:
    analytics.record(
        FirstTraceMetricSentEvent(
            user_id=get_owner_id(project),
            organization_id=project.organization_id,
            project_id=project.id,
            platform=project.platform,
        )
    )


# TODO (mifu67): update this to use the new org member invite model
@member_invited.connect(weak=False, dispatch_uid="onboarding.record_member_invited")
def record_member_invited(
    member: OrganizationMember,
    user: RequestPrincipal | None,
    referrer: str | None = None,
    **kwargs: object,
) -> None:
    complete_onboarding_task(
        organization=member.organization,
        task=OnboardingTask.INVITE_MEMBER,
    )

    analytics.record(
        MemberInvitedEvent(
            invited_member_id=member.id,
            inviter_user_id=acting_user_id(user) if user is not None else None,
            organization_id=member.organization_id,
            referrer=referrer,
        )
    )


def _record_release_received(project: Project, event: Event, **kwargs: object) -> None:
    return record_release_received(project, event.data.get("release"))


def record_release_received(project: Project, release: str | None, **kwargs: object) -> None:
    if not release:
        return

    completed = complete_onboarding_task(
        organization=project.organization,
        task=OnboardingTask.RELEASE_TRACKING,
        project_id=project.id,
    )

    if completed:
        if (owner_id := get_owner_id(project)) is None:
            logger.warning(
                "Cannot record release received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return

        analytics.record(
            FirstReleaseTagSentEvent(
                user_id=owner_id,
                project_id=project.id,
                organization_id=project.organization_id,
            )
        )


event_processed.connect(_record_release_received, weak=False)
transaction_processed.connect(_record_release_received, weak=False)


@first_event_with_minified_stack_trace_received.connect(
    weak=False, dispatch_uid="onboarding.record_event_with_first_minified_stack_trace_for_project"
)
def record_event_with_first_minified_stack_trace_for_project(
    project: Project, event: Event, **kwargs: object
) -> None:
    if (owner_id := get_owner_id(project)) is None:
        logger.warning(
            "Cannot record first event for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    if project.date_added > START_DATE_TRACKING_FIRST_EVENT_WITH_MINIFIED_STACK_TRACE_PER_PROJ:
        analytics.record(
            FirstEventSentEventWithMinifiedStackTraceForProject(
                user_id=owner_id,
                organization_id=project.organization_id,
                project_id=project.id,
                platform=event.platform,
                project_platform=project.platform,
                url=dict(event.tags).get("url", None),
            )
        )


@event_processed.connect(weak=False, dispatch_uid="onboarding.record_sourcemaps_received")
def record_sourcemaps_received(project: Project, event: Event, **kwargs: object) -> None:
    if not has_sourcemap(event):
        return

    completed = complete_onboarding_task(
        organization=project.organization,
        task=OnboardingTask.SOURCEMAPS,
        project_id=project.id,
    )
    if completed:
        if (owner_id := get_owner_id(project)) is None:
            logger.warning(
                "Cannot record sourcemaps received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return
        try:
            analytics.record(
                FirstSourcemapsSentEvent(
                    user_id=owner_id,
                    organization_id=project.organization_id,
                    project_id=project.id,
                    platform=event.platform,
                    project_platform=project.platform,
                    url=dict(event.tags).get("url", None),
                )
            )
        except Exception as e:
            sentry_sdk.capture_exception(e)


@event_processed.connect(
    weak=False, dispatch_uid="onboarding.record_sourcemaps_received_for_project"
)
def record_sourcemaps_received_for_project(
    project: Project, event: Event, **kwargs: object
) -> None:
    if not has_sourcemap(event):
        return

    # First, only enter this logic if we've never seen a minified stack trace before
    if not project.flags.has_sourcemaps:
        if (owner_id := get_owner_id(project)) is None:
            logger.warning(
                "Cannot record sourcemaps received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return

        # Next, attempt to update the flag, but ONLY if the flag is currently not set.
        # The number of affected rows tells us whether we succeeded or not. If we didn't, then skip sending the event.
        # This guarantees us that this analytics event will only be ever sent once.
        affected = Project.objects.filter(
            id=project.id, flags=F("flags").bitand(~Project.flags.has_sourcemaps)
        ).update(flags=F("flags").bitor(Project.flags.has_sourcemaps))

        if project.date_added > START_DATE_TRACKING_FIRST_SOURCEMAP_PER_PROJ and affected > 0:
            analytics.record(
                FirstSourcemapsSentEventForProject(
                    user_id=owner_id,
                    organization_id=project.organization_id,
                    project_id=project.id,
                    platform=event.platform,
                    project_platform=project.platform,
                    url=dict(event.tags).get("url", None),
                )
            )


@alert_rule_created.connect(weak=False, dispatch_uid="onboarding.record_alert_rule_created")
def record_alert_rule_created(
    user: RequestPrincipal | None, project: Project, rule_type: str, **kwargs: object
) -> None:
    # The quick start now only has a task for issue alert rules.
    # Please see https://github.com/getsentry/sentry/blob/c06a3aa5fb104406f2a44994d32983e99bc2a479/static/app/components/onboardingWizard/taskConfig.tsx#L351-L352
    if rule_type == "metric":
        return

    complete_onboarding_task(
        organization=project.organization,
        task=OnboardingTask.ALERT_RULE,
        user_id=acting_user_id(user) if user is not None else None,
        project_id=project.id,
    )


@integration_added.connect(weak=False, dispatch_uid="onboarding.record_integration_added")
def record_integration_added(
    integration_id: int, organization_id: int, user_id: int | None, **kwargs: object
) -> None:
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
            complete_onboarding_task(
                organization=Organization.objects.get_from_cache(id=organization_id),
                task=task_mapping[integration_type],
            )


@project_transferred.connect(weak=False, dispatch_uid="onboarding.record_project_transferred")
def record_project_transferred(old_org_id: int, project: Project, **kwargs: object) -> None:
    analytics.record(
        ProjectTransferredEvent(
            old_organization_id=old_org_id,
            new_organization_id=project.organization.id,
            project_id=project.id,
            platform=project.platform,
        )
    )

    transfer_onboarding_tasks(
        from_organization_id=old_org_id,
        to_organization_id=project.organization_id,
        project=project,
    )
