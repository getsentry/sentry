from social_auth.utils import setting


if setting('SOCIAL_AUTH_TEST_TWITTER', True):
    from social_auth.tests.twitter import *

if setting('SOCIAL_AUTH_TEST_FACEBOOK', True):
    from social_auth.tests.facebook import *

if setting('SOCIAL_AUTH_TEST_GOOGLE', True):
    from social_auth.tests.google import *

if setting('SOCIAL_AUTH_TEST_ODNOKLASSNIKI', True):
    from social_auth.tests.odnoklassniki import *