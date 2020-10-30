from __future__ import absolute_import

from django.db.models.signals import post_save

from sentry import analytics
from sentry.models import User


def capture_signal(type):
    def wrapped(instance, created, **kwargs):
        if created:
            analytics.record(type, instance)

    return wrapped


post_save.connect(
    capture_signal("user.created"), sender=User, dispatch_uid="analytics.user.created", weak=False
)
