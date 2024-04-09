from sentry.api.serializers import Serializer, register
from sentry.models.projecttemplate import ProjectTemplate


@register(ProjectTemplate)
class ProjectTemplateSerializer(Serializer):
    def serialize(self, obj, attrs, user):
        ret_val = {
            "id": str(obj.id),
            "name": obj.name,
            "dateCreated": obj.date_added,
        }

        has_options = obj.options

        # format options
        if has_options:
            ret_val["options"] = {}

        return ret_val
