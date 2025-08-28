from django.db.models.signals import post_save

from sentry.models.organization import Organization


def disable_member_project_creation(instance: Organization, created, **kwargs):
    if created:
        instance.flags.disable_member_project_creation = True
        instance.save()


post_save.connect(
    disable_member_project_creation,
    sender=Organization,
    dispatch_uid="default_disable_member_project_creation",
    weak=False,
)
