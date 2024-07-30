from enum import Enum


class ChannelName(Enum):
    FLY_IO = "fly"
    FLY_DISABLEABLE = "fly-disableable"


SPONSOR_OAUTH_NAME = {ChannelName.FLY_IO: "Fly.io", ChannelName.FLY_DISABLEABLE: "Fly.disableable"}
