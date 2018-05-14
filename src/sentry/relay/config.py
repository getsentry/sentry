from __future__ import absolute_import

import uuid

from datetime import datetime
from pytz import utc

from django.core.urlresolvers import reverse

from sentry.models import ProjectStatus, ProjectKey
from sentry.utils.http import absolute_uri


class Config(object):
    """
    Config object for relay
    """

    def __init__(self, project):
        self.project = project

    def get_project_options(self):
        """Returns a dict containing the config for a project for the sentry relay"""
        project_keys = ProjectKey.objects.filter(
            project=self.project,
        ).all()

        public_keys = {}
        for project_key in list(project_keys):
            public_keys[project_key.public_key] = project_key.status == 0

        now = datetime.utcnow().replace(tzinfo=utc)

        return {
            'disabled': self.project.status > 0,
            'slug': self.project.slug,
            'lastFetch': now,
            'lastChange': self.project.get_option('sentry:relay-rev-lastchange', now),
            'rev': self.project.get_option('sentry:relay-rev', uuid.uuid4().hex),
            'publicKeys': public_keys,
            'config': {
                'allowedDomains': self.project.get_option('sentry:origins', ['*']),
            }
        }

    def get_project_key_config(self, project_key):
        """Returns a dict containing the information for a specific project key"""
        return {
            'dsn': project_key.dsn_public,
        }

    def is_project_enabled(self):
        return self.project.status != ProjectStatus.VISIBLE

    def get_cdn_url(self, project_key):
        """Return the url to the js cdn file for a specific project key"""
        return absolute_uri(reverse('sentry-relay-cdn-loader', args=[project_key.public_key]))
