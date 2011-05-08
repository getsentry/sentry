import haystack
from haystack.indexes import *
from haystack.sites import SearchSite

from sentry.conf import settings
from sentry.utils import to_unicode
from sentry.models import GroupedMessage

if settings.SEARCH_ENGINE:
    # Ensure we stop here if we havent configure Sentry to work under haystack

    backend = haystack.load_backend(settings.SEARCH_ENGINE)

    class SentrySearchSite(SearchSite): pass

    site = SentrySearchSite()
    site.backend = backend.SearchBackend(site, **settings.SEARCH_OPTIONS)

    class GroupedMessageIndex(RealTimeSearchIndex):
        text = CharField(document=True, stored=False)
        status = IntegerField(model_attr='status', stored=False, null=True)
        level = IntegerField(model_attr='level', stored=False, null=True)
        logger = CharField(model_attr='logger', stored=False, null=True)
        server = MultiValueField(stored=False, null=True)
        url = MultiValueField(stored=False, null=True)
        site = MultiValueField(stored=False, null=True)
        first_seen = DateTimeField(model_attr='first_seen', stored=False)
        last_seen = DateTimeField(model_attr='last_seen', stored=False)

        # def get_queryset(self):
        #     """Used when the entire index for model is updated."""
        #     return GroupedMessage.objects.all()

        def get_updated_field(self):
            return 'last_seen'

        def get_content_field(self):
            return 'text'

        def prepare_text(self, instance):
            chunks = [instance.message, instance.class_name, instance.traceback, instance.view]
            chunks.extend(self.prepare_url(instance))
            return '\n'.join(map(to_unicode, filter(None, chunks)))

        def prepare_server(self, instance):
            return [to_unicode(s['server_name']) for s in instance.unique_servers]

        def prepare_site(self, instance):
            return [to_unicode(s['site']) for s in instance.unique_sites]

        def prepare_url(self, instance):
            return [to_unicode(s['url']) for s in instance.unique_urls]


    site.register(GroupedMessage, GroupedMessageIndex)
