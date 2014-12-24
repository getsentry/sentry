from social_auth.utils import setting


if setting('SOCIAL_AUTH_TEST_GOOGLE', True):
    from social_auth.tests.google import *
