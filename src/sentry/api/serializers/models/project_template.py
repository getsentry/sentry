from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from enum import StrEnum
from typing import Any, TypedDict

from sentry.api.serializers import Serializer, register
from sentry.models.options.project_template_option import TProjectOptions
from sentry.models.projecttemplate import ProjectTemplate
from sentry.models.user import User


class ProjectTemplateAttributes(StrEnum):
    OPTIONS = "options"


class SerializedProjectTemplate(TypedDict, total=False):
    id: int
    name: str
    createdAt: datetime | None
    updatedAt: datetime | None
    options: TProjectOptions | None


@register(ProjectTemplate)
class ProjectTemplateSerializer(Serializer):
    """
    This is used to serialize the project template model
    """

    def __init__(self, expand: Iterable[str] | None = None) -> None:
        self.expand = expand

    def _expand(self, key: str) -> bool:
        return self.expand is not None and key in self.expand

    def get_attrs(self, item_list: Sequence[ProjectTemplate], user: User, **kwargs: Any):
        attrs = super().get_attrs(item_list, user, **kwargs)
        all_attrs: dict[ProjectTemplate, dict[ProjectTemplateAttributes, Any]] = defaultdict(dict)

        if self._expand(ProjectTemplateAttributes.OPTIONS):
            for template in item_list:
                options = template.options.all()

                # TODO - serialize ProjectTemplateOptions
                serialized_options: TProjectOptions = {
                    option.key: option.value for option in options
                }

                all_attrs[template][ProjectTemplateAttributes.OPTIONS] = serialized_options

                # Merge the attrs from the parent with the options
                for key in attrs.get(template, {}).keys():
                    all_attrs[template][key] = attrs.get(template, {}).get(key)

        return all_attrs

    def serialize(
        self, obj: ProjectTemplate, attrs: Mapping[str, Any], user: User, **kwargs: Any
    ) -> SerializedProjectTemplate:
        response: SerializedProjectTemplate = {
            "id": obj.id,
            "name": obj.name,
            "createdAt": obj.date_added,
            "updatedAt": obj.date_updated,
        }

        if (options := attrs.get(ProjectTemplateAttributes.OPTIONS)) is not None:
            response["options"] = options

        return response
