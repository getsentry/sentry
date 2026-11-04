from __future__ import annotations

from collections.abc import Mapping, MutableMapping, Sequence
from datetime import datetime
from typing import Any, TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.auth.principal import has_user
from sentry.telemetry_classifiers.models import TelemetryClassifier
from sentry.users.api.serializers.user import UserSerializerResponse
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser
from sentry.users.services.user.service import user_service


class TelemetryClassifierResponse(TypedDict):
    id: str
    projectId: str
    name: str
    resultAttribute: str
    dataset: str
    filterQuery: str
    status: str
    prebuiltClassifierKey: str | None
    naturalLanguagePrompt: str | None
    outputType: str | None
    createdBy: UserSerializerResponse | None
    dateAdded: datetime
    dateUpdated: datetime


@register(TelemetryClassifier)
class TelemetryClassifierSerializer(Serializer[TelemetryClassifierResponse]):
    def get_attrs(
        self,
        item_list: Sequence[TelemetryClassifier],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> MutableMapping[TelemetryClassifier, dict[str, Any]]:
        creator_ids = {c.created_by_id for c in item_list if c.created_by_id is not None}
        serialized_users = (
            {
                u["id"]: u
                for u in user_service.serialize_many(
                    filter={"user_ids": list(creator_ids)},
                    as_user=user if has_user(user) else None,
                )
            }
            if creator_ids
            else {}
        )
        return {
            classifier: {"createdBy": serialized_users.get(str(classifier.created_by_id))}
            for classifier in item_list
        }

    def serialize(
        self,
        obj: TelemetryClassifier,
        attrs: Mapping[str, Any],
        user: User | RpcUser | AnonymousUser,
        **kwargs: Any,
    ) -> TelemetryClassifierResponse:
        return {
            "id": str(obj.id),
            "projectId": str(obj.project_id),
            "name": obj.name,
            "resultAttribute": obj.result_attribute,
            "dataset": obj.dataset,
            "filterQuery": obj.filter_query,
            "status": obj.status,
            "prebuiltClassifierKey": obj.prebuilt_classifier_key,
            "naturalLanguagePrompt": obj.natural_language_prompt,
            "outputType": obj.output_type,
            "createdBy": attrs["createdBy"],
            "dateAdded": obj.date_added,
            "dateUpdated": obj.date_updated,
        }
