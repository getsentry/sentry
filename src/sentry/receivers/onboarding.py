from __future__ import print_function, absolute_import

from django.db import IntegrityError, transaction

from sentry.models import (
    OnboardingTask, OnboardingTaskStatus, OrganizationOnboardingTask
)
from sentry.signals import first_event


@first_event.connect(weak=False)
def record_first_event(instance, **kwargs):
    try:
        with transaction.atomic():
            OrganizationOnboardingTask.objects.create(
                organization=instance.organization,
                project=instance,
                task=OnboardingTask.FIRST_EVENT,
                status=OnboardingTaskStatus.COMPLETE,
                date_completed=instance.first_event,
                data={},
            )
    except IntegrityError:
        OrganizationOnboardingTask.objects.filter(
            organization=instance.organization,
            task=OnboardingTask.FIRST_EVENT,
        ).exclude(
            status=OnboardingTaskStatus.COMPLETE,
        ).update(
            project=instance,
            date_completed=instance.first_event,
            data={},
        )
