from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.investigations.models import InvestigationParameter
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class InvestigationParameterSerializerResponse(TypedDict):
    id: str
    key: str
    label: str
    description: str
    type: str
    required: bool
    constraints: dict[str, Any]
    defaultValue: Any | None
    savedValue: Any | None
    source: str
    position: int
    version: int


@register(InvestigationParameter)
class InvestigationParameterSerializer(Serializer[InvestigationParameterSerializerResponse]):
    @override
    def serialize(
        self,
        obj: InvestigationParameter,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationParameterSerializerResponse:
        return {
            "id": str(obj.id),
            "key": obj.key,
            "label": obj.label,
            "description": obj.description,
            "type": obj.type,
            "required": obj.required,
            "constraints": obj.validation_constraints,
            "defaultValue": obj.default_value,
            "savedValue": obj.saved_value,
            "source": obj.source,
            "position": obj.position,
            "version": obj.version,
        }
