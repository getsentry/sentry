from __future__ import absolute_import

from sentry.auth.superuser import logger, Superuser


class SuperuserMiddleware(object):
    def process_request(self, request):
        if request.is_static:
            # XXX(dcramer): support legacy is_superuser calls for unauthenticated requests
            request.is_superuser = lambda: False
            return

        su = Superuser(request)

        request.superuser = su
        request.is_superuser = lambda: request.superuser.is_active

        if su.is_active:
            logger.info('superuser.request', extra={
                'url': request.build_absolute_uri(),
                'method': request.method,
                'ip_address': request.META['REMOTE_ADDR'],
                'user_id': request.user.id,
            })

    def process_response(self, request, response):
        try:
            if request.is_static:
                return response
        except AttributeError:
            pass
        su = getattr(request, 'superuser', None)
        if su:
            su.on_response(response)
        return response
