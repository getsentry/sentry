from typing import Optional, TypedDict


class SerializedAvatarFields(TypedDict):
    avatarType: str
    avatarUuid: Optional[str]
