"""
sentry.models.organizationonboardingtask
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings
from django.db import models

from sentry.db.models import (
    BoundedPositiveIntegerField,
    FlexibleForeignKey,
    Model,
    sane_repr
)

class OnboardingTask(object):
    FIRST_EVENT = 1
    INVITE_MEMBER = 2
    ISSUE_TRACKER = 3
    NOTIFICATION_SERVICE = 4
    SECOND_PLATFORM = 5  # dependent on FIRST_EVENT
    USER_CONTEXT = 6  # dependent on FIRST_EVENT
    SOURCEMAPS = 7  # dependent on RELEASE_TRACKING
    RELEASE_TRACKING = 8  # dependent on FIRST_EVENT
    USER_REPORTS = 9
    ISSUE_ASSIGNMENT = 10  # dependent on INVITE_MEMBER
    RELEASE_RESOLVED = 11  # dependent on RELEASE_TRACKING
    SAVED_SEARCHES = 12
    RULES = 13


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
    """
    TASK_CHOICES = (
        (OnboardingTask.FIRST_EVENT, 'First event'),  # Send an organization's first event to Sentry
        (OnboardingTask.INVITE_MEMBER, 'Invite member'),  # Add a second member to your Sentry org.
        (OnboardingTask.ISSUE_TRACKER, 'Issue tracker'),  # Hook up an external issue tracker.
        (OnboardingTask.NOTIFICATION_SERVICE, 'Notification services'),  # Setup a notification services
        (OnboardingTask.ISSUE_ASSIGNMENT, 'Issue assignment'),  # Assign issues to team members
        (OnboardingTask.SECOND_PLATFORM, 'Second platform'),  # Send an event from a second platform
        (OnboardingTask.USER_CONTEXT, 'User context'),  # Add user context to errors
        (OnboardingTask.SOURCEMAPS, 'Upload sourcemaps'),  # Upload sourcemaps for compiled js code
        (OnboardingTask.RELEASE_TRACKING, 'Release tracking'),  # Add release data to Sentry events
        (OnboardingTask.USER_REPORTS, 'User reports'),  # Send user reports
        (OnboardingTask.RELEASE_RESOLVED, 'Resolved in next release'),
        (OnboardingTask.SAVED_SEARCHES, 'Saved searches'),
        (OnboardingTask.RULES, 'Rules'),
    )
    INTIAL_TASKS = ['FE', 'IM', 'UC', 'RT']

    STATUS_CHOICES = (
        (OnboardingTaskStatus.COMPLETE, 'Complete'),
        (OnboardingTaskStatus.PENDING, 'Pending'),
        (OnboardingTaskStatus.SKIPPED, 'Skipped'),
    )

    organization = FlexibleForeignKey('sentry.Organization')
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)  # user that completed
    task = BoundedPositiveIntegerField(choices=TASK_CHOICES)
    status = BoundedPositiveIntegerField(choices=STATUS_CHOICES)
    date_completed = models.DateTimeField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationonboardingtask'
        unique_together = (('organization', 'task'),)

    __repr__ = sane_repr('organization', 'task')
