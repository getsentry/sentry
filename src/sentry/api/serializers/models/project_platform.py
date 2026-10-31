from collections.abc import Mapping
from datetime import datetime
from typing import TypedDict

from django.contrib.auth.models import AnonymousUser

from sentry.api.serializers import Serializer, register
from sentry.models.projectplatform import ProjectPlatform
from sentry.users.models.user import User
from sentry.users.services.user.model import RpcUser


class ProjectPlatformSerializerResponse(TypedDict):
    platform: str
    dateCreated: datetime


@register(ProjectPlatform)
class ProjectPlatformSerializer(Serializer[ProjectPlatformSerializerResponse]):
    """
    Tracks usage of a platform for a given project.

    Note: This model is used solely for analytics.
    """

    def serialize(
        self,
        obj: ProjectPlatform,
        attrs: Mapping[object, object],
        user: User | RpcUser | AnonymousUser,
        **kwargs: object,
    ) -> ProjectPlatformSerializerResponse:
        return {"platform": obj.platform, "dateCreated": obj.date_added}
