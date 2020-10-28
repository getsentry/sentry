from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.db.models.signals import post_delete, post_save

from sentry.models import Email, UserEmail


def create_email(instance, created, **kwargs):
    if created:
        try:
            with transaction.atomic():
                Email.objects.create(email=instance.email)
        except IntegrityError:
            pass


def delete_email(instance, **kwargs):
    if UserEmail.objects.filter(email__iexact=instance.email).exists():
        return

    Email.objects.filter(email=instance.email).delete()


post_save.connect(create_email, sender=UserEmail, dispatch_uid="create_email", weak=False)
post_delete.connect(delete_email, sender=UserEmail, dispatch_uid="delete_email", weak=False)
