from typing import int
from django.db.models.signals import post_save

from sentry import analytics
from sentry.analytics.events.user_created import UserCreatedEvent
from sentry.users.models.user import User


def on_user_post_save(instance: User, created: bool, **kwargs):
    if created:
        analytics.record(
            UserCreatedEvent(
                id=instance.id,
                username=instance.username,
                email=instance.email,
            )
        )


post_save.connect(
    on_user_post_save,
    sender=User,
    dispatch_uid="analytics.user.created",
    weak=False,
)
