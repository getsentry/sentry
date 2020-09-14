from __future__ import absolute_import

from sentry.api.serializers.models.plugin import PluginSerializer


class OrganizationPluginSerializer(PluginSerializer):
    def serialize(self, obj, attrs, user):
        data = super(OrganizationPluginSerializer, self).serialize(obj, attrs, user)
        data["project"] = {"id": self.project.id, "slug": self.project.slug}
        return data
