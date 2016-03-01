"""
sentry.models.organizationonboardingtask
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2016 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings
from django.db import models
from django.utils import timezone
from jsonfield import JSONField

from sentry.db.models import (
    BoundedBigIntegerField,
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr
)


class OnboardingTask(object):
    FIRST_PROJECT = 1
    FIRST_EVENT = 2
    INVITE_MEMBER = 3
    SECOND_PLATFORM = 4  # dependent on FIRST_EVENT.
    USER_CONTEXT = 5  # dependent on FIRST_EVENT
    RELEASE_TRACKING = 6  # dependent on FIRST_EVENT
    SOURCEMAPS = 7  # dependent on RELEASE_TRACKING and one of the platforms being javascript
    USER_REPORTS = 8  # Only for web frameworks
    ISSUE_TRACKER = 9
    NOTIFICATION_SERVICE = 10

    REQUIRED_ONBOARDING_TASKS = frozenset([1, 2, 3, 4, 5, 6, 7, 9, 10])


class OnboardingTaskStatus(object):
    """
    Pending is applicable for:
    first event: user confirms that sdk has been installed
    second platform: user confirms that sdk has been installed
    user context: user has added user context to sdk
    invite member: until the member has successfully joined org
    issue tracker: tracker added, issue not yet created
    """
    COMPLETE = 1
    PENDING = 2
    SKIPPED = 3


class OrganizationOnboardingTask(Model):
    """
    Onboarding tasks walk new Sentry orgs through basic features of Sentry.
    data field options (not all tasks have data fields):
        FIRST_EVENT: { 'platform':  'flask', }
        INVITE_MEMBER: { 'invited_member': user.id, 'teams': [team.id] }
        ISSUE_TRACKER | NOTIFICATION_SERVICE: { 'plugin': 'plugin_name' }
        ISSUE_ASSIGNMENT: { 'assigned_member': user.id }
        SECOND_PLATFORM: { 'platform': 'javascript' }
    """
    TASK_CHOICES = (
        (OnboardingTask.FIRST_EVENT, 'First event'),  # Send an organization's first event to Sentry
        (OnboardingTask.INVITE_MEMBER, 'Invite member'),  # Add a second member to your Sentry org.
        (OnboardingTask.ISSUE_TRACKER, 'Issue tracker'),  # Hook up an external issue tracker.
        (OnboardingTask.NOTIFICATION_SERVICE, 'Notification services'),  # Setup a notification services
        (OnboardingTask.SECOND_PLATFORM, 'Second platform'),  # Send an event from a second platform
        (OnboardingTask.USER_CONTEXT, 'User context'),  # Add user context to errors
        (OnboardingTask.SOURCEMAPS, 'Upload sourcemaps'),  # Upload sourcemaps for compiled js code
        (OnboardingTask.RELEASE_TRACKING, 'Release tracking'),  # Add release data to Sentry events
        (OnboardingTask.USER_REPORTS, 'User reports'),  # Send user reports
    )

    STATUS_CHOICES = (
        (OnboardingTaskStatus.COMPLETE, 'Complete'),
        (OnboardingTaskStatus.PENDING, 'Pending'),
        (OnboardingTaskStatus.SKIPPED, 'Skipped'),
    )

    organization = FlexibleForeignKey('sentry.Organization')
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=True)  # user that completed
    task = BoundedPositiveIntegerField(choices=TASK_CHOICES)
    status = BoundedPositiveIntegerField(choices=STATUS_CHOICES)
    date_completed = models.DateTimeField(default=timezone.now)
    project_id = BoundedBigIntegerField(blank=True, null=True)
    data = JSONField()  # INVITE_MEMBER { invited_member: user.id }

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationonboardingtask'
        unique_together = (('organization', 'task'),)

    __repr__ = sane_repr('organization', 'task')
