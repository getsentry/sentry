from __future__ import absolute_import

from django.core.urlresolvers import reverse

from sentry.models import ProjectStatus
from sentry.utils.http import absolute_uri


class Config(object):
    """
    Config object for relay
    """

    def get_project_config(self, project):
        """Returns a dict containing the config for a project for the sentry relay"""
        return {
            'allowedDomains': project.get_option('sentry:origins', ['*']),
        }

    def get_project_key_config(self, project_key):
        """Returns a dict containing the information for a specific project key"""
        return {
            'dsn': project_key.dsn_public,
        }

    def is_project_enabled(self, project):
        return project.status != ProjectStatus.VISIBLE

    def get_cdn_url(self, project_key):
        """Return the url to the js cdn file for a specific project key"""
        return absolute_uri(reverse('sentry-relay-cdn-loader', args=[project_key.public_key]))
