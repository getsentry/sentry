from __future__ import absolute_import


from sentry.api.serializers import Serializer, register
from sentry.plugins.config import PluginConfigMixin


@register(PluginConfigMixin)
class PluginSerializer(Serializer):
    def __init__(self, project=None):
        self.project = project

    def serialize(self, obj, attrs, user):
        d = {
            'id': obj.slug,
            'name': obj.get_title(),
            'type': obj.get_plugin_type(),
            'canDisable': obj.can_disable,
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
            )
        ]
        return d


def serialize_field(project, plugin, field):
    data = {
        'name': field['name'],
        'label': field.get('label') or field['name'].title().replace('_', ' '),
        'type': field.get('type', 'text'),
        'required': field.get('required', False),
        'help': field.get('help'),
        'placeholder': field.get('placeholder'),
        'choices': field.get('choices'),
        'readonly': field.get('readonly', False),
        'defaultValue': field.get('default'),
    }
    if field.get('type') != 'secret':
        data['value'] = plugin.get_option(field['name'], project)

    return data
