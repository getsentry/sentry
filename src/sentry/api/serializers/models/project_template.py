from collections import defaultdict
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from enum import StrEnum
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser
from rest_framework import serializers

from sentry.api.serializers import Serializer, register
from sentry.models.options.project_template_option import TProjectOptions
from sentry.models.projecttemplate import ProjectTemplate
from sentry.users.models.user import User
from sentry.users.services.user import RpcUser


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
    def __init__(self, expand: Iterable[ProjectTemplateAttributes] | None = None) -> None:
        self.expand = expand

    def _expand(self, key: ProjectTemplateAttributes) -> bool:
        return self.expand is not None and key in self.expand

    def get_attrs(
        self,
        item_list: Sequence[ProjectTemplate],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ):
        attrs = super().get_attrs(item_list, user, **kwargs)
        all_attrs: dict[ProjectTemplate, dict[ProjectTemplateAttributes, Any]] = defaultdict(dict)

        for template in item_list:
            all_attrs[template] = attrs.get(template, {})

        if self._expand(ProjectTemplateAttributes.OPTIONS):
            for template in item_list:
                options = template.options.all()

                serialized_options: TProjectOptions = {
                    option.key: option.value for option in options
                }

                all_attrs[template][ProjectTemplateAttributes.OPTIONS] = serialized_options

        return all_attrs

    def serialize(
        self,
        obj: ProjectTemplate,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
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


class ProjectTemplateWriteSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    name = serializers.CharField(required=True)
    options = serializers.DictField(required=False)

    def validate(self, data):
        return data
