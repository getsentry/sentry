"""
sentry.models.organizationonboardingtask
~~~~~~~~~~~~~~~~~~~~~~~~~~~~

:copyright: (c) 2010-2014 by the Sentry Team, see AUTHORS for more details.
:license: BSD, see LICENSE for more details.
"""
from django.conf import settings
from django.db import models

from sentry.db.models import FlexibleForeignKey, Model, sane_repr
from django.utils import timezone

class OrganizationOnboardingTask(Model):
    """
    Onboarding tasks walk new Sentry orgs through basic features of Sentry.
    """
    TASK_CHOICES = (
        ('T', 'Tour'),  # Walkthrough a tour of Sentry
        ('E', 'First event'),  # Send an organization's first event to Sentry
        ('P', 'Second platform'),  # Send an event from a second platform
        ('M', 'Invite member'),  # Add a second member to your Sentry org.
        ('I', 'Issue tracker'),  # Hook up an external issue tracker.
        ('N', 'Notification'),  # Setup a notification services
        ('A', 'Issue assignment'),  # Assign issues to team members
        ('C', 'User context'),  # Add user context to errors
        ('S', 'Upload sourcemaps'),  # Upload sourcemaps for compiled js code
        ('R', 'Release tracking'),  # Add release data to Sentry events
        ('U', 'Sentry updates'),  # Monthly Sentry updates (new features, security, releases)
    )

    organization = FlexibleForeignKey('sentry.Organization')
    user = FlexibleForeignKey(settings.AUTH_USER_MODEL, null=False)  # user that completed
    task = models.CharField(max_length=1, choices=TASK_CHOICES, null=False)
    completed = models.BooleanField(default=False, null=False)
    date_completed = models.DateTimeField(default=timezone.now)

    class Meta:
        app_label = 'sentry'
        db_table = 'sentry_organizationonboardingtask'
        unique_together = (('organization', 'task'),)

    __repr__ = sane_repr('organization', 'task')
