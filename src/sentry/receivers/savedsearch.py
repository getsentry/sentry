from __future__ import absolute_import, print_function

from django.db.models.signals import post_save

from sentry.models import Project, SavedSearch
from sentry.models.savedsearch import DEFAULT_SAVED_SEARCHES


def create_default_saved_searches(instance, created=True, **kwargs):
    if not created:
        return

    for search_kwargs in DEFAULT_SAVED_SEARCHES:
        SavedSearch.objects.create(project=instance, **search_kwargs)


post_save.connect(
    create_default_saved_searches,
    sender=Project,
    dispatch_uid="create_default_saved_searches",
    weak=False,
)
