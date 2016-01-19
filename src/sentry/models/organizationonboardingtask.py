"""
sentry.models.organizationonboardingtask
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr

class OnboardingTask(object):
    FIRST_EVENT = 1
    INVITE_MEMBER = 2
    ISSUE_TRACKER = 3
    NOTIFICATION_SERVICE = 4
    SECOND_PLATFORM = 5
    USER_CONTEXT = 6
    SOURCEMAPS = 7
    RELEASE_TRACKING = 8
    USER_REPORTS = 9
    SENTRY_UPDATES = 10
    ISSUE_ASSIGNMENT = 11

class OnboardingTaskStatus(object):
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
        (OnboardingTask.SENTRY_UPDATES, 'Sentry updates'),  # Monthly Sentry updates (new features, releases)
    )
    INTIAL_TASKS = ['FE', 'IM', 'UC', 'RT']

    STATUS_CHOICES = (
        (OnboardingTaskStatus.COMPLETE, 'Complete'),
        (OnboardingTaskStatus.PENDING, 'Pending'),
        (OnboardingTaskStatus.SKIPPED, 'Skipped'),
    )

    organization = FlexibleForeignKey('sentry.Organization')
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)  # user that completed
    task = models.BoundedPositiveIntegerField(choices=TASK_CHOICES)
    status = models.BoundedPositiveIntegerField(choices=STATUS_CHOICES)
    date_completed = models.DateTimeField()

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationonboardingtask'
        unique_together = (('organization', 'task'),)

    __repr__ = sane_repr('organization', 'task')
