from __future__ import absolute_import

from sentry import auth, options

from .provider import GoogleOAuth2Provider

auth.register('google', GoogleOAuth2Provider)

options.register(
    'auth-google.client-id',
    flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,
)
options.register(
    'auth-google.client-secret',
    flags=options.FLAG_ALLOW_EMPTY | options.FLAG_PRIORITIZE_DISK,
)
