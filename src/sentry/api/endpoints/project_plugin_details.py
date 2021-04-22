from django import forms
from django.urls import reverse
from rest_framework import serializers
from rest_framework.response import Response

from sentry.api.bases.project import ProjectEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.api.serializers.models.plugin import (
    PluginSerializer,
    PluginWithConfigSerializer,
    serialize_field,
)
from sentry.exceptions import InvalidIdentity, PluginError, PluginIdentityRequired
from sentry.models import AuditLogEntryEvent
from sentry.plugins.base import plugins
from sentry.signals import plugin_enabled

ERR_ALWAYS_ENABLED = "This plugin is always enabled."
ERR_FIELD_REQUIRED = "This field is required."

OK_UPDATED = "Successfully updated configuration."


class ProjectPluginDetailsEndpoint(ProjectEndpoint):
    def _get_plugin(self, plugin_id):
        try:
            return plugins.get(plugin_id)
        except KeyError:
            raise ResourceDoesNotExist

    def get(self, request, project, plugin_id):
        plugin = self._get_plugin(plugin_id)

        try:
            context = serialize(plugin, request.user, PluginWithConfigSerializer(project))
        except PluginIdentityRequired as e:
            context = serialize(plugin, request.user, PluginSerializer(project))
            context["config_error"] = str(e)
            context["auth_url"] = reverse("socialauth_associate", args=[plugin.slug])

        return Response(context)

    def post(self, request, project, plugin_id):
        """
        Enable plugin, Test plugin or Reset plugin values
        """
        plugin = self._get_plugin(plugin_id)

        if request.data.get("test") and plugin.is_testable():
            test_results = plugin.test_configuration_and_get_test_results(project)
            return Response({"detail": test_results}, status=200)

        if request.data.get("reset"):
            plugin = self._get_plugin(plugin_id)
            plugin.reset_options(project=project)
            context = serialize(plugin, request.user, PluginWithConfigSerializer(project))

            self.create_audit_entry(
                request=request,
                organization=project.organization,
                target_object=project.id,
                event=AuditLogEntryEvent.INTEGRATION_EDIT,
                data={"integration": plugin_id, "project": project.slug},
            )

            return Response(context, status=200)

        if not plugin.can_disable:
            return Response({"detail": ERR_ALWAYS_ENABLED}, status=400)

        plugin.enable(project)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.INTEGRATION_ADD,
            data={"integration": plugin_id, "project": project.slug},
        )

        return Response(status=201)

    def delete(self, request, project, plugin_id):
        """
        Disable plugin
        """
        plugin = self._get_plugin(plugin_id)

        if not plugin.can_disable:
            return Response({"detail": ERR_ALWAYS_ENABLED}, status=400)

        plugin.disable(project)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.INTEGRATION_REMOVE,
            data={"integration": plugin_id, "project": project.slug},
        )

        return Response(status=204)

    def put(self, request, project, plugin_id):
        plugin = self._get_plugin(plugin_id)

        config = [
            serialize_field(project, plugin, c)
            for c in plugin.get_config(project=project, user=request.user, initial=request.data)
        ]

        cleaned = {}
        errors = {}
        for field in config:
            key = field["name"]
            value = request.data.get(key)

            if field.get("required") and not value:
                errors[key] = ERR_FIELD_REQUIRED

            try:
                value = plugin.validate_config_field(
                    project=project, name=key, value=value, actor=request.user
                )
            except (
                forms.ValidationError,
                serializers.ValidationError,
                InvalidIdentity,
                PluginError,
            ) as e:
                errors[key] = str(e)

            if not errors.get(key):
                cleaned[key] = value

        if not errors:
            try:
                cleaned = plugin.validate_config(
                    project=project, config=cleaned, actor=request.user
                )
            except (InvalidIdentity, PluginError) as e:
                errors["__all__"] = str(e)

        if errors:
            return Response({"errors": errors}, status=400)

        for key, value in cleaned.items():
            if value is None:
                plugin.unset_option(project=project, key=key)
            else:
                plugin.set_option(project=project, key=key, value=value)

        context = serialize(plugin, request.user, PluginWithConfigSerializer(project))

        plugin_enabled.send(plugin=plugin, project=project, user=request.user, sender=self)

        self.create_audit_entry(
            request=request,
            organization=project.organization,
            target_object=project.id,
            event=AuditLogEntryEvent.INTEGRATION_EDIT,
            data={"integration": plugin_id, "project": project.slug},
        )

        return Response(context)
