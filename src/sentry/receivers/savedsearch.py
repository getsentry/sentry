from __future__ import absolute_import, print_function

from django.db.models.signals import post_save

from sentry.models import Project, SavedSearch


def create_default_saved_searches(instance, created=True, **kwargs):
    if not created:
        return

    SavedSearch.objects.create(
        project=instance,
        name='Unresolved Issues',
        query='is:unresolved',
        is_default=True,
    )

    SavedSearch.objects.create(
        project=instance,
        name='Needs Triage',
        query='is:unresolved is:unassigned',
    )

    SavedSearch.objects.create(
        project=instance,
        name='Assigned To Me',
        query='is:unresolved assigned:me',
    )

    SavedSearch.objects.create(
        project=instance,
        name='My Bookmarks',
        query='is:unresolved bookmarks:me',
    )

    SavedSearch.objects.create(
        project=instance,
        name='New Today',
        query='is:unresolved age:-24h',
    )


post_save.connect(
    create_default_saved_searches,
    sender=Project,
    dispatch_uid="create_default_saved_searches",
    weak=False,
)
