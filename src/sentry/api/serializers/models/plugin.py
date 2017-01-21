from __future__ import absolute_import

import six

from sentry.api.serializers import Serializer
from sentry.utils.assets import get_asset_url
from sentry.utils.http import absolute_uri


class PluginSerializer(Serializer):
    def __init__(self, project=None):
        self.project = project

    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.slug,
            'name': six.text_type(obj.get_title()),
            'type': obj.get_plugin_type(),
            'canDisable': obj.can_disable,
            'isTestable': obj.is_testable(),
            'metadata': obj.get_metadata(),
            'assets': [
                {
                    'url': absolute_uri(get_asset_url(obj.asset_key or obj.slug, asset)),
                }
                for asset in obj.get_assets()
            ],
        }
        if self.project:
            d['enabled'] = obj.is_enabled(self.project)
        return d


class PluginWithConfigSerializer(PluginSerializer):
    def __init__(self, project=None):
        self.project = project

    def serialize(self, obj, attrs, user):
        d = super(PluginWithConfigSerializer, self).serialize(obj, attrs, user)
        d['config'] = [
            serialize_field(self.project, obj, c)
            for c in obj.get_config(
                project=self.project,
                user=user
            )
        ]
        return d


def serialize_field(project, plugin, field):
    data = {
        'name': six.text_type(field['name']),
        'label': six.text_type(field.get('label') or field['name'].title().replace('_', ' ')),
        'type': field.get('type', 'text'),
        'required': field.get('required', True),
        'help': six.text_type(field['help']) if field.get('help') else None,
        'placeholder': six.text_type(field['placeholder']) if field.get('placeholder') else None,
        'choices': field.get('choices'),
        'readonly': field.get('readonly', False),
        'defaultValue': field.get('default'),
        'value': None
    }
    if field.get('type') != 'secret':
        data['value'] = plugin.get_option(field['name'], project)
    else:
        data['has_saved_value'] = bool(field.get('has_saved_value', False))
        data['prefix'] = field.get('prefix', '')

    return data
