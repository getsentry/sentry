from sentry.conf import settings


class SentryMiddleware(object):
    # DEPRECATED
    pass


class AccessControlMiddleware(object):
    """
    This middleware provides the Access-Control-Allow-Origin and
    Access-Control-Allow-Headers header to enable cross-site HTTP requests. You
    can find more information about these headers here:
    https://developer.mozilla.org/En/HTTP_access_control#Simple_requests
    """

    def process_response(self, request, response):
        origin = getattr(settings, 'ALLOW_ORIGIN', None)
        if origin:
            response['Access-Control-Allow-Origin'] = origin
            response['Access-Control-Allow-Headers'] = 'X-Sentry-Auth'
        return response
