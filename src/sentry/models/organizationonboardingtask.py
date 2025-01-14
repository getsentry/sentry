from __future__ import annotations

from typing import Any, ClassVar

from django.conf import settings
from django.core.cache import cache
from django.db import IntegrityError, models, router, transaction
from django.utils import timezone

from sentry.backup.scopes import RelocationScope
from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    region_silo_model,
    sane_repr,
)
from sentry.db.models.fields.hybrid_cloud_foreign_key import HybridCloudForeignKey
from sentry.db.models.manager.base import BaseManager


# NOTE: There are gaps in the numberation because a few tasks were removed, e.g. in the PR https://github.com/getsentry/sentry/pull/83360
class OnboardingTask:
    FIRST_PROJECT = 1
    FIRST_EVENT = 2
    INVITE_MEMBER = 3
    SECOND_PLATFORM = 4
    USER_CONTEXT = 5
    RELEASE_TRACKING = 6
    SOURCEMAPS = 7
    USER_REPORTS = 8
    ALERT_RULE = 10
    FIRST_TRANSACTION = 11
    METRIC_ALERT = 12
    SESSION_REPLAY = 14
    REAL_TIME_NOTIFICATIONS = 15
    LINK_SENTRY_TO_SOURCE_CODE = 16


class OnboardingTaskStatus:
    COMPLETE = 1
    PENDING = 2
    SKIPPED = 3


# NOTE: data fields for some event types are as follows:
#
#   FIRST_EVENT:      { 'platform':  'flask', }
#   INVITE_MEMBER:    { 'invited_member': user.id, 'teams': [team.id] }
#   SECOND_PLATFORM:  { 'platform': 'javascript' }
#
# NOTE: Currently the `PENDING` status is applicable for the following
# onboarding tasks:
#
#   FIRST_EVENT:     User confirms that sdk has been installed
#   INVITE_MEMBER:   Until the member has successfully joined org
#   SECOND_PLATFORM: User confirms that sdk has been installed


class OrganizationOnboardingTaskManager(BaseManager["OrganizationOnboardingTask"]):
    def record(self, organization_id, task, **kwargs):
        cache_key = f"organizationonboardingtask:{organization_id}:{task}"
        if cache.get(cache_key) is None:
            try:
                with transaction.atomic(router.db_for_write(OrganizationOnboardingTask)):
                    self.create(organization_id=organization_id, task=task, **kwargs)
                    return True
            except IntegrityError:
                pass

            # Store marker to prevent running all the time
            cache.set(cache_key, 1, 3600)

        return False


class AbstractOnboardingTask(Model):
    """
    An abstract onboarding task that can be subclassed. This abstract model exists so that the Sandbox can create a subclass
    which allows for the creation of tasks that are unique to users instead of organizations.
    """

    __relocation_scope__ = RelocationScope.Excluded

    STATUS_CHOICES = (
        (OnboardingTaskStatus.COMPLETE, "complete"),
        (OnboardingTaskStatus.PENDING, "pending"),
        (OnboardingTaskStatus.SKIPPED, "skipped"),
    )

    STATUS_KEY_MAP = dict(STATUS_CHOICES)
    STATUS_LOOKUP_BY_KEY = {v: k for k, v in STATUS_CHOICES}

    organization = FlexibleForeignKey("sentry.Organization")
    user_id = HybridCloudForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete="SET_NULL")
    status = BoundedPositiveIntegerField(choices=[(k, str(v)) for k, v in STATUS_CHOICES])
    completion_seen = models.DateTimeField(null=True)
    date_completed = models.DateTimeField(default=timezone.now)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False, null=True)
    # INVITE_MEMBER { invited_member: user.id }
    data: models.Field[dict[str, Any], dict[str, Any]] = JSONField()

    # abstract
    TASK_LOOKUP_BY_KEY: dict[str, int]
    SKIPPABLE_TASKS: frozenset[int]
    NEW_SKIPPABLE_TASKS: frozenset[int]

    class Meta:
        abstract = True


@region_silo_model
class OrganizationOnboardingTask(AbstractOnboardingTask):
    """
    Onboarding tasks walk new Sentry orgs through basic features of Sentry.
    """

    TASK_CHOICES = (
        (OnboardingTask.FIRST_PROJECT, "create_project"),
        (OnboardingTask.FIRST_EVENT, "send_first_event"),
        (OnboardingTask.INVITE_MEMBER, "invite_member"),
        (OnboardingTask.SECOND_PLATFORM, "setup_second_platform"),
        (OnboardingTask.RELEASE_TRACKING, "setup_release_tracking"),
        (OnboardingTask.SOURCEMAPS, "setup_sourcemaps"),
        # TODO(Telemety Experience): Check if we can remove this from the frontend
        (OnboardingTask.USER_REPORTS, "setup_user_reports"),
        (OnboardingTask.ALERT_RULE, "setup_alert_rules"),
        (OnboardingTask.FIRST_TRANSACTION, "setup_transactions"),
        # TODO(Telemety Experience): Check if we can remove this from the frontend
        (OnboardingTask.METRIC_ALERT, "setup_metric_alert_rules"),
        (OnboardingTask.SESSION_REPLAY, "setup_session_replay"),
        (OnboardingTask.REAL_TIME_NOTIFICATIONS, "setup_real_time_notifications"),
        (OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE, "link_sentry_to_source_code"),
    )

    # Used in the API to map IDs to string keys. This keeps things
    # a bit more maintainable on the frontend.
    TASK_KEY_MAP = dict(TASK_CHOICES)
    TASK_LOOKUP_BY_KEY = {v: k for k, v in TASK_CHOICES}

    task = BoundedPositiveIntegerField(choices=[(k, str(v)) for k, v in TASK_CHOICES])

    # Tasks which should be completed for the onboarding to be considered
    # complete.
    NEW_REQUIRED_ONBOARDING_TASKS = frozenset(
        [
            OnboardingTask.FIRST_PROJECT,
            OnboardingTask.FIRST_EVENT,
            OnboardingTask.INVITE_MEMBER,
            OnboardingTask.SECOND_PLATFORM,
            OnboardingTask.RELEASE_TRACKING,
            OnboardingTask.ALERT_RULE,
            OnboardingTask.FIRST_TRANSACTION,
            OnboardingTask.SESSION_REPLAY,
            OnboardingTask.REAL_TIME_NOTIFICATIONS,
            OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE,
        ]
    )

    NEW_REQUIRED_ONBOARDING_TASKS_WITH_SOURCE_MAPS = frozenset(
        [
            *NEW_REQUIRED_ONBOARDING_TASKS,
            OnboardingTask.SOURCEMAPS,
        ]
    )

    NEW_SKIPPABLE_TASKS = frozenset(
        [
            OnboardingTask.INVITE_MEMBER,
            OnboardingTask.SECOND_PLATFORM,
            OnboardingTask.RELEASE_TRACKING,
            OnboardingTask.SOURCEMAPS,
            OnboardingTask.ALERT_RULE,
            OnboardingTask.FIRST_TRANSACTION,
            OnboardingTask.SESSION_REPLAY,
            OnboardingTask.REAL_TIME_NOTIFICATIONS,
            OnboardingTask.LINK_SENTRY_TO_SOURCE_CODE,
        ]
    )

    objects: ClassVar[OrganizationOnboardingTaskManager] = OrganizationOnboardingTaskManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationonboardingtask"
        unique_together = (("organization", "task"),)

    __repr__ = sane_repr("organization", "task")
