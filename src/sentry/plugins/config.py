from __future__ import absolute_import

__all__ = ['PluginConfigMixin']

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
        for config in self.get_config(project=project):
            if config['name'] != name:
                continue

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

    def get_group_urls(self):
        return []

    def get_project_urls(self):
        return []
