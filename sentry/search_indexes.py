import haystack
from haystack.indexes import *
from haystack.sites import SearchSite

from sentry import conf
from sentry.models import GroupedMessage

if conf.SEARCH_ENGINE:
    # Ensure we stop here if we havent configure Sentry to work under haystack

    backend = haystack.load_backend(conf.SEARCH_ENGINE)

    class SentrySearchSite(SearchSite): pass

    site = SentrySearchSite()
    site.backend = backend.SearchBackend(site, **conf.SEARCH_OPTIONS)

    class GroupedMessageIndex(RealTimeSearchIndex):
        text = CharField(document=True, stored=False)
        status = CharField(stored=False, null=True)
        first_seen = DateTimeField(model_attr='first_seen', stored=False)
        last_seen = DateTimeField(model_attr='last_seen', stored=False)

        # def get_queryset(self):
        #     """Used when the entire index for model is updated."""
        #     return GroupedMessage.objects.all()

        def prepare_text(self, instance):
            return '\n'.join(filter(None, [instance.message, instance.class_name, instance.traceback, instance.view]))

    site.register(GroupedMessage, GroupedMessageIndex)
