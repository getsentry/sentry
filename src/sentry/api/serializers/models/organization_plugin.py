from sentry.api.serializers.models.plugin import PluginSerializer


class OrganizationPluginSerializer(PluginSerializer):
    def serialize(self, obj, attrs, user):
        data = super().serialize(obj, attrs, user)
        data["project"] = {"id": self.project.id, "slug": self.project.slug}
        return data
