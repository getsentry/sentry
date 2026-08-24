from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping, MutableMapping, Sequence
from collections.abc import Set as AbstractSet
from datetime import datetime
from typing import Any, TypedDict, override

from django.contrib.auth.models import AnonymousUser
from django.db.models import Count, Q

from sentry.api.serializers import Serializer, register, serialize
from sentry.investigations.endpoints.serializers.block import (
    InvestigationBlockSerializer,
    InvestigationBlockSerializerResponse,
)
from sentry.investigations.endpoints.serializers.parameter import (
    InvestigationParameterSerializer,
    InvestigationParameterSerializerResponse,
)
from sentry.investigations.models import (
    Investigation,
    InvestigationBlock,
    InvestigationFavoriteUser,
    InvestigationParameter,
    InvestigationProject,
)
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class InvestigationTemplateSerializerResponse(TypedDict):
    key: str | None
    version: int | None


class InvestigationSourceSerializerResponse(TypedDict):
    type: str
    ref: dict[str, Any]
    revision: int | None


class InvestigationTitleGenerationSerializerResponse(TypedDict):
    status: str | None


class InvestigationSerializerResponse(TypedDict):
    id: str
    title: str
    status: str
    sourceType: str
    createdBy: str | None
    dateCreated: datetime
    dateUpdated: datetime
    version: int
    blockCount: int
    isFavorited: bool


class InvestigationDetailsSerializerResponse(InvestigationSerializerResponse):
    template: InvestigationTemplateSerializerResponse | None
    source: InvestigationSourceSerializerResponse
    filters: dict[str, Any]
    projectIds: list[int]
    parameters: list[InvestigationParameterSerializerResponse]
    blocks: list[InvestigationBlockSerializerResponse]
    titleGeneration: InvestigationTitleGenerationSerializerResponse


@register(Investigation)
class InvestigationSerializer(Serializer):
    @override
    def get_attrs(
        self,
        item_list: Sequence[Investigation],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Investigation, dict[str, Any]]:
        block_counts = dict(
            Investigation.objects.filter(id__in=[i.id for i in item_list])
            .annotate(active_block_count=Count("blocks", filter=Q(blocks__deleted_at__isnull=True)))
            .values_list("id", "active_block_count")
        )

        favorited_ids: set[int] = set()
        user_id = getattr(user, "id", None)
        if user_id is not None:
            favorited_ids = set(
                InvestigationFavoriteUser.objects.filter(
                    user_id=user_id, investigation__in=item_list
                ).values_list("investigation_id", flat=True)
            )

        return {
            investigation: {
                "block_count": block_counts.get(investigation.id, 0),
                "is_favorited": investigation.id in favorited_ids,
            }
            for investigation in item_list
        }

    @override
    def serialize(
        self,
        obj: Investigation,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationSerializerResponse:
        return {
            "id": str(obj.id),
            "title": obj.title,
            "status": obj.status,
            "sourceType": obj.source_type,
            "createdBy": (str(obj.created_by_id) if obj.created_by_id is not None else None),
            "dateCreated": obj.date_added,
            "dateUpdated": obj.date_updated,
            "version": obj.version,
            "blockCount": attrs["block_count"],
            "isFavorited": attrs["is_favorited"],
        }


class InvestigationDetailsSerializer(InvestigationSerializer):
    """
    Serializes an investigation along with its project selection, parameters,
    and blocks. Use this for single-investigation reads; the base serializer
    omits the nested collections so list reads stay cheap.
    """

    def __init__(self, accessible_project_ids: AbstractSet[int]) -> None:
        self.accessible_project_ids = accessible_project_ids

    def _blocks_by_investigation(
        self, item_list: Sequence[Investigation], user: User | RpcUser | AnonymousUser
    ) -> MutableMapping[int, list[InvestigationBlockSerializerResponse]]:
        blocks = list(
            InvestigationBlock.objects.filter(
                investigation__in=item_list, deleted_at__isnull=True
            ).order_by("position", "id")
        )
        serialized = serialize(
            blocks,
            user,
            InvestigationBlockSerializer(accessible_project_ids=self.accessible_project_ids),
        )

        by_investigation: MutableMapping[int, list[InvestigationBlockSerializerResponse]] = (
            defaultdict(list)
        )
        for block, block_response in zip(blocks, serialized):
            by_investigation[block.investigation_id].append(block_response)
        return by_investigation

    def _parameters_by_investigation(
        self, item_list: Sequence[Investigation], user: User | RpcUser | AnonymousUser
    ) -> MutableMapping[int, list[InvestigationParameterSerializerResponse]]:
        parameters = list(
            InvestigationParameter.objects.filter(investigation__in=item_list).order_by(
                "position", "id"
            )
        )
        serialized = serialize(parameters, user, InvestigationParameterSerializer())

        by_investigation: MutableMapping[int, list[InvestigationParameterSerializerResponse]] = (
            defaultdict(list)
        )
        for parameter, parameter_response in zip(parameters, serialized):
            by_investigation[parameter.investigation_id].append(parameter_response)
        return by_investigation

    @override
    def get_attrs(
        self,
        item_list: Sequence[Investigation],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[Investigation, dict[str, Any]]:
        attrs = super().get_attrs(item_list, user, **kwargs)

        blocks_by_investigation = self._blocks_by_investigation(item_list, user)
        parameters_by_investigation = self._parameters_by_investigation(item_list, user)

        project_ids_by_investigation: MutableMapping[int, list[int]] = defaultdict(list)
        for investigation_id, project_id in (
            InvestigationProject.objects.filter(investigation__in=item_list)
            .order_by("project_id")
            .values_list("investigation_id", "project_id")
        ):
            project_ids_by_investigation[investigation_id].append(project_id)

        for investigation in item_list:
            attrs[investigation]["blocks"] = blocks_by_investigation[investigation.id]
            attrs[investigation]["parameters"] = parameters_by_investigation[investigation.id]
            attrs[investigation]["project_ids"] = project_ids_by_investigation[investigation.id]

        return attrs

    @override
    def serialize(
        self,
        obj: Investigation,
        attrs: Mapping[Any, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> InvestigationDetailsSerializerResponse:
        return {
            **super().serialize(obj, attrs, user, **kwargs),
            "template": (
                {"key": obj.template_key, "version": obj.template_version}
                if obj.template_key is not None
                else None
            ),
            "source": {
                "type": obj.source_type,
                "ref": obj.source_ref,
                "revision": obj.source_revision,
            },
            "filters": obj.filters,
            "projectIds": attrs["project_ids"],
            "parameters": attrs["parameters"],
            "blocks": attrs["blocks"],
            "titleGeneration": {"status": obj.title_generation_status},
        }
