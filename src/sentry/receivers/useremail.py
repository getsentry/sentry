from __future__ import absolute_import

from django.db import IntegrityError
from django.db.models.signals import post_save

from sentry.models import User, UserEmail


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
