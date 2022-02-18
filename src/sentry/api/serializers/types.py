from typing import Optional

from typing_extensions import TypedDict


class SerializedAvatarFields(TypedDict):
    avatarType: str
    avatarUuid: Optional[str]


class SCIMMeta(TypedDict):
    resourceType: str
