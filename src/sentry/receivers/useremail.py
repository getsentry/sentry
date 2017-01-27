from __future__ import absolute_import

from django.db import IntegrityError
from django.db.models.signals import post_save
from django.utils import timezone

from sentry.models import User, UserEmail
from sentry.signals import email_verified


def create_user_email(instance, created, **kwargs):
    if created:
        try:
            UserEmail.objects.create(email=instance.email, user=instance)
        except IntegrityError:
            pass

post_save.connect(
    create_user_email,
    sender=User,
    dispatch_uid="create_user_email",
    weak=False
)


@email_verified.connect(weak=False)
def verify_newsletter_subscription(sender, **kwargs):
    from sentry.app import newsletter

    if not newsletter.enabled:
        return

    if not sender.is_primary():
        return

    newsletter.update_subscription(
        sender.user,
        verified=True,
        verified_date=timezone.now(),
    )
