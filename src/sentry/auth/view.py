from __future__ import absolute_import, print_function

__all__ = ('AuthView',)

from sentry.web.frontend.base import BaseView


class AuthView(BaseView):
    """
    A segment of Provider's auth pipeline.
    """
    auth_required = False
    sudo_required = False

    def dispatch(self, request, provider):
        """
        Returns an ``HttpResponse``.
        """
        raise NotImplementedError

    def get_ident(self):
        cls = type(self)
        return '{module}.{name}'.format(
            module=cls.__module__,
            name=cls.__name__,
        )
