from enum import Enum


class ChannelName(Enum):
    FLY_IO = "fly.io"


<<<<<<< HEAD
SPONSOR_OAUTH_NAME = {ChannelName.FLY_IO: "Fly.io"}
=======
SPONSORSHIP_TO_CHANNEL_MAP = {
    4: ChannelName.FLY_IO
}

SPONSOR_OAUTH_NAME = {
    ChannelName.FLY_IO: "Fly IO"
}
>>>>>>> aef2fff949 ([WIP]feat(fly-auth): remove fly auth from list)
