from __future__ import absolute_import

from django.db import IntegrityError, transaction
from django.db.models.signals import post_delete, post_save

from sentry.models import Email, UserEmail, User, LostPasswordHash


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


def remove_lost_password_hashes_by_user(instance, **kwargs):
    LostPasswordHash.objects.filter(user=instance).delete()


def remove_lost_password_hashes_by_useremail(instance, **kwargs):
    LostPasswordHash.objects.filter(user=instance.user).delete()

post_save.connect(create_email, sender=UserEmail, dispatch_uid="create_email", weak=False)
post_delete.connect(delete_email, sender=UserEmail, dispatch_uid="delete_email", weak=False)

post_save.connect(remove_lost_password_hashes_by_user,
                  sender=User,
                  dispatch_uid='remove_lost_password_hashes_by_user',
                  weak=False)
post_save.connect(remove_lost_password_hashes_by_useremail,
                  sender=UserEmail,
                  dispatch_uid='remove_lost_password_hashes_by_useremail',
                  weak=False)
