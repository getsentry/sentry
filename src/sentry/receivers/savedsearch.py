from __future__ import absolute_import, print_function

from django.db.models.signals import post_save

from sentry.models import Project, SavedSearch

DEFAULT_SAVED_SEARCHES = [
    {
        'name': 'Unresolved Issues',
        'query': 'is:unresolved',
        'is_default': True
    },
    {
        'name': 'Needs Triage',
        'query': 'is:unresolved is:unassigned'
    },
    {
        'name': 'Assigned To Me',
        'query': 'is:unresolved assigned:me'
    },
    {
        'name': 'My Bookmarks',
        'query': 'is:unresolved bookmarks:me'
    },
    {
        'name': 'New Today',
        'query': 'is:unresolved age:-24h'
    },
]


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
