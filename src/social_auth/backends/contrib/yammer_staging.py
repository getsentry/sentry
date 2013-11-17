"""
Yammer Staging OAuth2 support
"""
from social_auth.backends.contrib.yammer import YammerBackend, YammerOAuth2


YAMMER_STAGING_SERVER = 'staging.yammer.com'
YAMMER_STAGING_OAUTH_URL = 'https://www.%s/oauth2/' % YAMMER_STAGING_SERVER
YAMMER_STAGING_AUTH_URL = 'https://www.%s/dialog/oauth' % YAMMER_STAGING_SERVER


class YammerStagingBackend(YammerBackend):
    name = 'yammer_staging'


class YammerStagingOAuth2(YammerOAuth2):
    AUTH_BACKEND = YammerStagingBackend
    AUTHORIZATION_URL = YAMMER_STAGING_AUTH_URL
    ACCESS_TOKEN_URL = '%s%s' % (YAMMER_STAGING_OAUTH_URL, 'access_token')
    REQUEST_TOKEN_URL = '%s%s' % (YAMMER_STAGING_OAUTH_URL, 'request_token')
    SETTINGS_KEY_NAME = 'YAMMER_STAGING_CONSUMER_KEY'
    SETTINGS_SECRET_NAME = 'YAMMER_STAGING_CONSUMER_SECRET'


BACKENDS = {
    'yammer_staging': YammerStagingOAuth2
}
