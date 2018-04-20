from __future__ import absolute_import

from sentry.utils.http import absolute_uri
from django.core.urlresolvers import reverse


class Config(object):
    """
    Config object for relay
    """

    def __init__(self, project, project_key):
        self.project = project
        self.project_key = project_key
        self.get_cdn_url = lambda: self.__class__.get_cdn_url(self)

    def to_dict(self):
        """Returns a dict containing config information for the sentry relay"""
        return {
            'allowedDomains': self.project.get_option('sentry:origins', ['*']),
            'enabled': self.project_key.is_active,
            'dsn': self.project_key.dsn_public,
        }

    def get_cdn_url(self):
        """Return the url to the js cdn file for a specific project key"""
        return absolute_uri(reverse('sentry-relay-cdn-loader'))
