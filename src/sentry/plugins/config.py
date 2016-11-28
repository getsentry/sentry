from __future__ import absolute_import

__all__ = ['PluginConfigMixin']

import six

from django.conf.urls import include, url

from sentry.exceptions import PluginError
from sentry.utils.forms import form_to_config

from .validators import DEFAULT_VALIDATORS


class PluginConfigMixin(object):
    asset_key = None
    assets = []

    def get_assets(self):
        return self.assets

    def get_metadata(self):
        """
        Return extra metadata which is used to represent this plugin.

        This is available via the API, and commonly used for runtime
        configuration that changes per-install, but not per-project.
        """
        return {}

    def get_config(self, project, **kwargs):
        form = self.project_conf_form
        if not form:
            return []

        return form_to_config(form)

    def validate_config_field(self, project, name, value, actor=None):
        """
        ```
        if name == 'foo' and value != 'bar':
            raise PluginError('foo must be bar')
        return value
        ```
        """
        for config in self.get_config(project=project, user=actor):
            if config['name'] != name:
                continue

            if value is None:
                if config.get('required'):
                    raise PluginError('Field is required')
                if config.get('type') == 'secret':
                    value = self.get_option(name, project)
                return value

            if isinstance(value, six.string_types):
                value = value.strip()
                # TODO(dcramer): probably should do something with default
                # validations here, though many things will end up bring string
                # based
                if not value:
                    if config.get('required'):
                        raise PluginError('Field is required')
                    if config.get('type') == 'secret':
                        value = self.get_option(name, project)

            for validator in DEFAULT_VALIDATORS.get(config['type'], ()):
                value = validator(project=project, value=value, actor=actor)

            for validator in config.get('validators', ()):
                value = validator(value, project=project, actor=actor)
            return value
        return value

    def validate_config(self, project, config, actor=None):
        """
        ```
        if config['foo'] and not config['bar']:
            raise PluginError('You cannot configure foo with bar')
        return config
        ```
        """
        return config

    def get_urls(self):
        """
        """
        patterns = []
        result = self.get_project_urls()
        if result:
            patterns.append(
                url(r'^api/0/projects/(?P<organization_slug>[^\/]+)/(?P<project_slug>[^\/]+)/',
                    include(result))
            )
        result = self.get_project_urls()
        if result:
            patterns.append(
                url(r'^api/0/organizations/(?P<organization_slug>[^\/]+)/',
                    include(result))
            )
        result = self.get_project_urls()
        if result:
            patterns.append(
                url(r'^api/0/issues/(?P<issue_id>\d+)/',
                    include(result))
            )
        result = self.get_url_module()
        if result:
            patterns.append(result)
        return patterns

    def get_group_urls(self):
        return []

    def get_project_urls(self):
        return []

    def get_organization_urls(self):
        return []

    def get_organization_option(self, name, organization, default=None):
        from sentry.models import OrganizationOption

        return OrganizationOption.objects.get_value(
            organization=organization,
            key='{}:{}'.format(self.conf_key, name),
            default=default,
        )
