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

        ret_val["options"] = {}

        # This is scary, look around to see if there are better ways to handle this
        options = obj.options.all()

        if len(options) > 0:
            for option in options:
                ret_val["options"][option.key] = option.value

        return ret_val
