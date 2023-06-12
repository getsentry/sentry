from sentry.auth.providers.oauth2 import OAuth2Provider
from sentry.auth.partnership_config import SPONSOR_OAUTH_NAME, ChannelName


class FlyOAuth2Provider(OAuth2Provider):

    name = ChannelName.FLY_IO
    is_partner = SPONSOR_OAUTH_NAME[ChannelName.FLY_IO]
