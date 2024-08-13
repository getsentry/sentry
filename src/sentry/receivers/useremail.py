from django.db import IntegrityError
from django.db.models.signals import post_save

from sentry.models.useremail import UserEmail
from sentry.users.models.user import User


def create_user_email(instance, created, **kwargs):
    if created:
        try:
            UserEmail.objects.create(email=instance.email, user=instance)
        except IntegrityError:
            pass


post_save.connect(create_user_email, sender=User, dispatch_uid="create_user_email", weak=False)
