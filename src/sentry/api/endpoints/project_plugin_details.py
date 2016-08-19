from __future__ import absolute_import

import six

from django import forms
from rest_framework import serializers
from rest_framework.response import Response

from sentry.plugins import plugins
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist

ERR_ALWAYS_ENABLED = 'This plugin is always enabled.'
ERR_FIELD_REQUIRED = 'This field is required.'
ERR_FIELD_INVALID = 'Invalid value.'

OK_UPDATED = 'Successfully updated configuration.'


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


class ProjectPluginDetailsEndpoint(ProjectEndpoint):
    def _get_plugin(self, plugin_id):
        try:
            return plugins.get(plugin_id)
        except KeyError:
            raise ResourceDoesNotExist

    def get(self, request, project, plugin_id):
        plugin = self._get_plugin(plugin_id)

        return Response({
            'id': plugin.slug,
            'name': plugin.get_title(),
            'enabled': plugin.is_enabled(project),
            'type': plugin.get_plugin_type(),
            'canDisable': plugin.can_disable,
            'config': [
                serialize_field(project, plugin, c)
                for c in plugin.get_config(
                    request=request,
                    project=project,
                )
            ],
        })

    def post(self, request, project, plugin_id):
        """
        Enable plugin
        """
        plugin = self._get_plugin(plugin_id)

        if not plugin.can_disable:
            return Response({'detail': ERR_ALWAYS_ENABLED}, status=400)

        plugin.enable(project)

        return Response(status=201)

    def delete(self, request, project, plugin_id):
        """
        Disable plugin
        """
        plugin = self._get_plugin(plugin_id)

        if not plugin.can_disable:
            return Response({'detail': ERR_ALWAYS_ENABLED}, status=400)

        plugin.disable(project)

        return Response(status=204)

    def put(self, request, project, plugin_id):
        plugin = self._get_plugin(plugin_id)

        config = plugin.get_config(
            request=request,
            project=project,
        )

        cleaned = {}
        errors = {}
        for field in config:
            key = field['name']
            value = request.DATA.get(key)

            if field.get('required') and not value:
                errors[key] = ERR_FIELD_REQUIRED

            for validator in field.get('validators', ()):
                try:
                    value = validator(value)
                except (forms.ValidationError, serializers.ValidationError) as e:
                    errors[key] = e.message

            if not errors.get(key):
                cleaned[key] = value

        if errors:
            return Response({
                'errors': errors,
            }, status=400)

        for key, value in six.iteritems(cleaned):
            plugin.set_option(
                project=project,
                key=key,
                value=value,
            )

        return Response({'message': OK_UPDATED})
