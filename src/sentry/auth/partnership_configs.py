from enum import Enum


class ChannelName(Enum):
    FLY_IO = "fly"
    FLY_DEACTIVATED = "fly-deactivated"


SPONSOR_OAUTH_NAME = {ChannelName.FLY_IO: "Fly.io"}
