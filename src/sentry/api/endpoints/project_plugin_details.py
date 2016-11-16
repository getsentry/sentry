from __future__ import absolute_import

import six

from django import forms
from django.core.urlresolvers import reverse
from rest_framework import serializers
from rest_framework.response import Response

from sentry.exceptions import PluginError, PluginIdentityRequired
from sentry.plugins import plugins
from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import (
    PluginSerializer, PluginWithConfigSerializer, serialize_field
)

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

        try:
            context = serialize(
                plugin, request.user, PluginWithConfigSerializer(project))
        except PluginIdentityRequired as e:
            context = serialize(plugin, request.user, PluginSerializer(project))
            context['config_error'] = e.message
            context['auth_url'] = reverse('socialauth_associate', args=[plugin.slug])

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

        config = [
            serialize_field(project, plugin, c)
            for c in plugin.get_config(
                project=project,
                user=request.user,
            )
        ]

        cleaned = {}
        errors = {}
        for field in config:
            key = field['name']
            value = request.DATA.get(key)

            if field.get('required') and not value:
                errors[key] = ERR_FIELD_REQUIRED

            try:
                value = plugin.validate_config_field(
                    project=project,
                    name=key,
                    value=value,
                    actor=request.user,
                )
            except (forms.ValidationError, serializers.ValidationError, PluginError) as e:
                errors[key] = e.message

            if not errors.get(key):
                cleaned[key] = value

        if not errors:
            try:
                cleaned = plugin.validate_config(
                    project=project,
                    config=cleaned,
                    actor=request.user,
                )
            except PluginError as e:
                errors['__all__'] = e.message

        if errors:
            return Response({
                'errors': errors,
            }, status=400)

        for key, value in six.iteritems(cleaned):
            if value is None:
                plugin.unset_option(
                    project=project,
                    key=key,
                )
            else:
                plugin.set_option(
                    project=project,
                    key=key,
                    value=value,
                )

        context = serialize(
            plugin, request.user, PluginWithConfigSerializer(project))

        return Response(context)
