from enum import Enum


class ChannelName(Enum):
    FLY_IO = "fly"
    FLY_NON_PARTNER = "fly-non-partner"
    VERCEL = "vercel"


SPONSOR_OAUTH_NAME = {
    ChannelName.FLY_IO: "Fly.io",
    ChannelName.FLY_NON_PARTNER: "Fly.io",
    ChannelName.VERCEL: "Vercel",
}
