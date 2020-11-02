from __future__ import absolute_import

import six
from django.conf import settings
from django.core.cache import cache
from django.db import models, IntegrityError, transaction
from django.utils import timezone

from sentry.db.models import (
    BaseManager,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    JSONField,
    Model,
    sane_repr,
)


class OnboardingTask(object):
    FIRST_PROJECT = 1
    FIRST_EVENT = 2
    INVITE_MEMBER = 3
    SECOND_PLATFORM = 4
    USER_CONTEXT = 5
    RELEASE_TRACKING = 6
    SOURCEMAPS = 7
    USER_REPORTS = 8
    ISSUE_TRACKER = 9
    ALERT_RULE = 10
    FIRST_TRANSACTION = 11


class OnboardingTaskStatus(object):
    COMPLETE = 1
    PENDING = 2
    SKIPPED = 3


# NOTE: data fields for some event types are as follows:
#
#   FIRST_EVENT:      { 'platform':  'flask', }
#   INVITE_MEMBER:    { 'invited_member': user.id, 'teams': [team.id] }
#   ISSUE_TRACKER:    { 'plugin': 'plugin_name' }
#   ISSUE_ASSIGNMENT: { 'assigned_member': user.id }
#   SECOND_PLATFORM:  { 'platform': 'javascript' }
#
# NOTE: Currently the `PENDING` status is applicable for the following
# onboarding tasks:
#
#   FIRST_EVENT:     User confirms that sdk has been installed
#   INVITE_MEMBER:   Until the member has successfully joined org
#   SECOND_PLATFORM: User confirms that sdk has been installed
#   USER_CONTEXT:    User has added user context to sdk
#   ISSUE_TRACKER:   Tracker added, issue not yet created


class OrganizationOnboardingTaskManager(BaseManager):
    def record(self, organization_id, task, **kwargs):
        cache_key = "organizationonboardingtask:%s:%s" % (organization_id, task)
        if cache.get(cache_key) is None:
            try:
                with transaction.atomic():
                    self.create(organization_id=organization_id, task=task, **kwargs)
                    return True
            except IntegrityError:
                pass

            # Store marker to prevent running all the time
            cache.set(cache_key, 1, 3600)

        return False


class OrganizationOnboardingTask(Model):
    """
    Onboarding tasks walk new Sentry orgs through basic features of Sentry.
    """

    __core__ = False

    TASK_CHOICES = (
        (OnboardingTask.FIRST_PROJECT, "create_project"),
        (OnboardingTask.FIRST_EVENT, "send_first_event"),
        (OnboardingTask.INVITE_MEMBER, "invite_member"),
        (OnboardingTask.SECOND_PLATFORM, "setup_second_platform"),
        (OnboardingTask.USER_CONTEXT, "setup_user_context"),
        (OnboardingTask.RELEASE_TRACKING, "setup_release_tracking"),
        (OnboardingTask.SOURCEMAPS, "setup_sourcemaps"),
        (OnboardingTask.USER_REPORTS, "setup_user_reports"),
        (OnboardingTask.ISSUE_TRACKER, "setup_issue_tracker"),
        (OnboardingTask.ALERT_RULE, "setup_alert_rules"),
        (OnboardingTask.FIRST_TRANSACTION, "setup_transactions"),
    )

    STATUS_CHOICES = (
        (OnboardingTaskStatus.COMPLETE, "complete"),
        (OnboardingTaskStatus.PENDING, "pending"),
        (OnboardingTaskStatus.SKIPPED, "skipped"),
    )

    # Used in the API to map IDs to string keys. This keeps things
    # a bit more maintainable on the frontend.
    TASK_KEY_MAP = dict(TASK_CHOICES)
    TASK_LOOKUP_BY_KEY = {v: k for k, v in TASK_CHOICES}

    STATUS_KEY_MAP = dict(STATUS_CHOICES)
    STATUS_LOOKUP_BY_KEY = {v: k for k, v in STATUS_CHOICES}

    # Tasks which must be completed for the onboarding to be considered
    # complete.
    REQUIRED_ONBOARDING_TASKS = frozenset(
        [
            OnboardingTask.FIRST_PROJECT,
            OnboardingTask.FIRST_EVENT,
            OnboardingTask.INVITE_MEMBER,
            OnboardingTask.SECOND_PLATFORM,
            OnboardingTask.USER_CONTEXT,
            OnboardingTask.RELEASE_TRACKING,
            OnboardingTask.SOURCEMAPS,
            OnboardingTask.ISSUE_TRACKER,
            OnboardingTask.ALERT_RULE,
            OnboardingTask.FIRST_TRANSACTION,
        ]
    )

    SKIPPABLE_TASKS = frozenset(
        [
            OnboardingTask.INVITE_MEMBER,
            OnboardingTask.SECOND_PLATFORM,
            OnboardingTask.USER_CONTEXT,
            OnboardingTask.RELEASE_TRACKING,
            OnboardingTask.SOURCEMAPS,
            OnboardingTask.USER_REPORTS,
            OnboardingTask.ISSUE_TRACKER,
            OnboardingTask.ALERT_RULE,
            OnboardingTask.FIRST_TRANSACTION,
        ]
    )

    organization = FlexibleForeignKey("sentry.Organization")
    user = FlexibleForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )  # user that completed
    task = BoundedPositiveIntegerField(choices=[(k, six.text_type(v)) for k, v in TASK_CHOICES])
    status = BoundedPositiveIntegerField(choices=[(k, six.text_type(v)) for k, v in STATUS_CHOICES])
    completion_seen = models.DateTimeField(null=True)
    date_completed = models.DateTimeField(default=timezone.now)
    project = FlexibleForeignKey("sentry.Project", db_constraint=False, null=True)
    data = JSONField()  # INVITE_MEMBER { invited_member: user.id }

    objects = OrganizationOnboardingTaskManager()

    class Meta:
        app_label = "sentry"
        db_table = "sentry_organizationonboardingtask"
        unique_together = (("organization", "task"),)

    __repr__ = sane_repr("organization", "task")
