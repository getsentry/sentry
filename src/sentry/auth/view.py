from __future__ import absolute_import, print_function

__all__ = ['AuthView', 'ConfigureView']

from sentry.plugins.base.view import PluggableViewMixin
from sentry.web.frontend.base import BaseView


class AuthView(BaseView):
    """
    A segment of Provider's auth pipeline.

    See ``BaseView`` for capabilities.
    """
    auth_required = False
    sudo_required = False

    def get_ident(self):
        cls = type(self)
        return '{module}.{name}'.format(
            module=cls.__module__,
            name=cls.__name__,
        )


class ConfigureView(BaseView, PluggableViewMixin):
    """
    """

    def dispatch(self, request, organization, auth_provider):
        return ''
