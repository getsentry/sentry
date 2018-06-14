from __future__ import absolute_import

from django.conf import settings


class StaticMiddleware(object):
    """
    Detect and flag requests that are for destined for static resources
    """

    def process_request(self, request):
        # This avoids touching user session, which means we avoid
        # setting `Vary: Cookie` as a response header which will
        # break HTTP caching entirely.
        request.is_static = request.path_info.startswith(settings.ANONYMOUS_STATIC_PREFIXES)
