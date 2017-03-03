from __future__ import absolute_import, print_function

from django.db.models.signals import post_save

from sentry.models import Project, SavedSearch
from sentry.signals import save_search_created


DEFAULT_SAVED_SEARCHES = [
    {'name': 'is:unresolved', 'query': 'is:unresolved', 'is_default': True},
    {'name': 'Needs Triage', 'query': 'is:unresolved is:unassigned'},
    {'name': 'Assigned To Me', 'query': 'is:unresolved assigned:me'},
    {'name': 'My Bookmarks', 'query': 'is:unresolved bookmarks:me'},
    {'name': 'New Today', 'query': 'is:unresolved age:-24h'},
]


def create_default_saved_searches(instance, created=True, **kwargs):
    if not created:
        return

    for search_kwargs in DEFAULT_SAVED_SEARCHES:
        SavedSearch.objects.create(project=instance, **search_kwargs)


def created_custom_saved_search(instance, created=True, **kwargs):
    if not created:
        return

    save_search_created.send(sender=instance)

post_save.connect(
    create_default_saved_searches,
    sender=Project,
    dispatch_uid="create_default_saved_searches",
    weak=False,
)

post_save.connect(
    created_custom_saved_search,
    sender=SavedSearch,
    dispatch_uid="created_custom_saved_search",
    weak=False,
)
