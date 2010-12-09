import haystack
from haystack.sites import SearchSite

haystack.autodiscover()

site = SearchSite()
