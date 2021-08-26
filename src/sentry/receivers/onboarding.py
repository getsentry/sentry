import logging

from django.db import IntegrityError, transaction
from django.db.models import F, Q
from django.utils import timezone

from sentry import analytics
from sentry.models import (
    OnboardingTask,
    OnboardingTaskStatus,
    Organization,
    OrganizationOnboardingTask,
    OrganizationOption,
    Project,
)
from sentry.plugins.bases import IssueTrackingPlugin, IssueTrackingPlugin2
from sentry.plugins.bases.notify import NotificationPlugin
from sentry.signals import (
    alert_rule_created,
    event_processed,
    first_event_pending,
    first_event_received,
    first_transaction_received,
    issue_tracker_used,
    member_invited,
    member_joined,
    plugin_enabled,
    project_created,
    transaction_processed,
)
from sentry.utils.javascript import has_sourcemap


def try_mark_onboarding_complete(organization_id):
    if OrganizationOption.objects.filter(
        organization_id=organization_id, key="onboarding:complete"
    ).exists():
        return

    completed = set(
        OrganizationOnboardingTask.objects.filter(
            Q(organization_id=organization_id)
            & (Q(status=OnboardingTaskStatus.COMPLETE) | Q(status=OnboardingTaskStatus.SKIPPED))
        ).values_list("task", flat=True)
    )
    if completed >= OrganizationOnboardingTask.REQUIRED_ONBOARDING_TASKS:
        try:
            with transaction.atomic():
                OrganizationOption.objects.create(
                    organization_id=organization_id,
                    key="onboarding:complete",
                    value={"updated": timezone.now()},
                )
        except IntegrityError:
            pass


@project_created.connect(weak=False)
def record_new_project(project, user, **kwargs):
    if user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user = user_id = None
        try:
            default_user_id = (
                Organization.objects.get(id=project.organization_id).get_default_owner().id
            )
        except IndexError:
            logging.getLogger("sentry").warning(
                "Cannot initiate onboarding for organization (%s) due to missing owners",
                project.organization_id,
            )
            # XXX(dcramer): we cannot setup onboarding tasks without a user
            return

    analytics.record(
        "project.created",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        project_id=project.id,
        platform=project.platform,
    )

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_PROJECT,
        user=user,
        status=OnboardingTaskStatus.COMPLETE,
        project_id=project.id,
    )
    if not success:
        OrganizationOnboardingTask.objects.record(
            organization_id=project.organization_id,
            task=OnboardingTask.SECOND_PLATFORM,
            user=user,
            status=OnboardingTaskStatus.PENDING,
            project_id=project.id,
        )


@first_event_pending.connect(weak=False)
def record_raven_installed(project, user, **kwargs):
    OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.FIRST_EVENT,
        status=OnboardingTaskStatus.PENDING,
        user=user,
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
        user = Organization.objects.get(id=project.organization_id).get_default_owner()
    except IndexError:
        logging.getLogger("sentry").warning(
            "Cannot record first event for organization (%s) due to missing owners",
            project.organization_id,
        )
        return

    if rows_affected or created:
        analytics.record(
            "first_event.sent",
            user_id=user.id,
            organization_id=project.organization_id,
            project_id=project.id,
            platform=event.platform,
        )
        return

    try:
        oot = OrganizationOnboardingTask.objects.filter(
            organization_id=project.organization_id, task=OnboardingTask.FIRST_EVENT
        )[0]
    except IndexError:
        return

    # Only counts if it's a new project and platform
    if oot.project_id != project.id and oot.data.get("platform", event.platform) != event.platform:
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
                user_id=user.id,
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


@member_invited.connect(weak=False)
def record_member_invited(member, user, **kwargs):
    OrganizationOnboardingTask.objects.record(
        organization_id=member.organization_id,
        task=OnboardingTask.INVITE_MEMBER,
        user=user,
        status=OnboardingTaskStatus.PENDING,
        data={"invited_member_id": member.id},
    )
    analytics.record(
        "member.invited",
        invited_member_id=member.id,
        inviter_user_id=user.id,
        organization_id=member.organization_id,
        referrer=kwargs.get("referrer"),
    )


@member_joined.connect(weak=False)
def record_member_joined(member, organization, **kwargs):
    rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
        organization_id=member.organization_id,
        task=OnboardingTask.INVITE_MEMBER,
        status=OnboardingTaskStatus.PENDING,
        values={
            "status": OnboardingTaskStatus.COMPLETE,
            "date_completed": timezone.now(),
            "data": {"invited_member_id": member.id},
        },
    )
    if created or rows_affected:
        try_mark_onboarding_complete(member.organization_id)


def record_release_received(project, event, **kwargs):
    if not event.get_tag("sentry:release"):
        return

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=OnboardingTask.RELEASE_TRACKING,
        status=OnboardingTaskStatus.COMPLETE,
        project_id=project.id,
    )
    if success:
        try:
            user = Organization.objects.get(id=project.organization_id).get_default_owner()
        except IndexError:
            logging.getLogger("sentry").warning(
                "Cannot record release received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return

        analytics.record(
            "first_release_tag.sent",
            user_id=user.id,
            project_id=project.id,
            organization_id=project.organization_id,
        )
        try_mark_onboarding_complete(project.organization_id)


event_processed.connect(record_release_received, weak=False)
transaction_processed.connect(record_release_received, weak=False)


def record_user_context_received(project, event, **kwargs):
    user_context = event.data.get("user")
    if not user_context:
        return
    # checking to see if only ip address is being sent (our js library does this automatically)
    # testing for this in test_no_user_tracking_for_ip_address_only
    # list(d.keys()) pattern is to make this python3 safe
    elif list(user_context.keys()) != ["ip_address"]:
        success = OrganizationOnboardingTask.objects.record(
            organization_id=project.organization_id,
            task=OnboardingTask.USER_CONTEXT,
            status=OnboardingTaskStatus.COMPLETE,
            project_id=project.id,
        )
        if success:
            try:
                user = Organization.objects.get(id=project.organization_id).get_default_owner()
            except IndexError:
                logging.getLogger("sentry").warning(
                    "Cannot record user context received for organization (%s) due to missing owners",
                    project.organization_id,
                )
                return

            analytics.record(
                "first_user_context.sent",
                user_id=user.id,
                organization_id=project.organization_id,
                project_id=project.id,
            )
            try_mark_onboarding_complete(project.organization_id)


event_processed.connect(record_user_context_received, weak=False)
transaction_processed.connect(record_user_context_received, weak=False)


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
        try:
            user = Organization.objects.get(id=project.organization_id).get_default_owner()
        except IndexError:
            logging.getLogger("sentry").warning(
                "Cannot record sourcemaps received for organization (%s) due to missing owners",
                project.organization_id,
            )
            return
        analytics.record(
            "first_sourcemaps.sent",
            user_id=user.id,
            organization_id=project.organization_id,
            project_id=project.id,
        )
        try_mark_onboarding_complete(project.organization_id)


@plugin_enabled.connect(weak=False)
def record_plugin_enabled(plugin, project, user, **kwargs):
    if isinstance(plugin, IssueTrackingPlugin) or isinstance(plugin, IssueTrackingPlugin2):
        task = OnboardingTask.ISSUE_TRACKER
        status = OnboardingTaskStatus.PENDING
    elif isinstance(plugin, NotificationPlugin):
        task = OnboardingTask.ALERT_RULE
        status = OnboardingTaskStatus.COMPLETE
    else:
        return

    success = OrganizationOnboardingTask.objects.record(
        organization_id=project.organization_id,
        task=task,
        status=status,
        user=user,
        project_id=project.id,
        data={"plugin": plugin.slug},
    )
    if success:
        try_mark_onboarding_complete(project.organization_id)

    analytics.record(
        "plugin.enabled",
        user_id=user.id,
        organization_id=project.organization_id,
        project_id=project.id,
        plugin=plugin.slug,
    )


@alert_rule_created.connect(weak=False)
def record_alert_rule_created(user, project, rule, **kwargs):
    rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
        organization_id=project.organization_id,
        task=OnboardingTask.ALERT_RULE,
        values={
            "status": OnboardingTaskStatus.COMPLETE,
            "user": user,
            "project_id": project.id,
            "date_completed": timezone.now(),
        },
    )

    if rows_affected or created:
        try_mark_onboarding_complete(project.organization_id)


@issue_tracker_used.connect(weak=False)
def record_issue_tracker_used(plugin, project, user, **kwargs):
    rows_affected, created = OrganizationOnboardingTask.objects.create_or_update(
        organization_id=project.organization_id,
        task=OnboardingTask.ISSUE_TRACKER,
        status=OnboardingTaskStatus.PENDING,
        values={
            "status": OnboardingTaskStatus.COMPLETE,
            "user": user,
            "project_id": project.id,
            "date_completed": timezone.now(),
            "data": {"plugin": plugin.slug},
        },
    )

    if rows_affected or created:
        try_mark_onboarding_complete(project.organization_id)

    if user and user.is_authenticated:
        user_id = default_user_id = user.id
    else:
        user_id = None
        try:
            default_user_id = project.organization.get_default_owner().id
        except IndexError:
            logging.getLogger("sentry").warning(
                "Cannot record issue tracker used for organization (%s) due to missing owners",
                project.organization_id,
            )
            return

    analytics.record(
        "issue_tracker.used",
        user_id=user_id,
        default_user_id=default_user_id,
        organization_id=project.organization_id,
        project_id=project.id,
        issue_tracker=plugin.slug,
    )
