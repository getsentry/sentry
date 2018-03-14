from __future__ import absolute_import

from django.conf import settings
from six.moves.urllib.parse import urlparse

from sentry import options
from sentry.api.serializers import serialize


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
        key = self.project_key.public_key
        url = settings.SENTRY_PUBLIC_ENDPOINT or settings.SENTRY_ENDPOINT

        if url:
            urlparts = urlparse(url)
        else:
            urlparts = urlparse(options.get('system.url-prefix'))

        return '%s://%s@%s/%s.js' % (
            urlparts.scheme, key, urlparts.netloc + urlparts.path, self.project.id,
        )

    def render_javascript_file(self):
        """Returns the javascript file for the user to integrate on their website"""
        return serialize(self.to_dict())
