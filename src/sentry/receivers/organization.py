from django.db.models.signals import post_save

from sentry.models.organization import Organization


def create_user_email(instance: Organization, created, **kwargs):
    if created:
        instance.flags.disable_member_project_creation = True
        instance.save()


post_save.connect(
    create_user_email,
    sender=Organization,
    dispatch_uid="default_disable_member_project_creation",
    weak=False,
)
