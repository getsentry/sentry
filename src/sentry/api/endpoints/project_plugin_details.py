from __future__ import absolute_import

import six

from django import forms
from rest_framework import serializers
from rest_framework.response import Response

from sentry.plugins import plugins
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import PluginWithConfigSerializer

ERR_ALWAYS_ENABLED = 'This plugin is always enabled.'
ERR_FIELD_REQUIRED = 'This field is required.'

OK_UPDATED = 'Successfully updated configuration.'


class ProjectPluginDetailsEndpoint(ProjectEndpoint):
    def _get_plugin(self, plugin_id):
        try:
            return plugins.get(plugin_id)
        except KeyError:
            raise ResourceDoesNotExist

    def get(self, request, project, plugin_id):
        plugin = self._get_plugin(plugin_id)

        context = serialize(
            plugin, request.user, PluginWithConfigSerializer(project))

        return Response(context)

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
