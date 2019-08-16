from __future__ import absolute_import, print_function

from django.conf import settings


AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/auth"

ACCESS_TOKEN_URL = "https://www.googleapis.com/oauth2/v4/token"

ERR_INVALID_DOMAIN = (
    "The domain for your Google account (%s) is not allowed to authenticate with this provider."
)

ERR_INVALID_RESPONSE = "Unable to fetch user information from Google.  Please check the log."

SCOPE = "email"

DOMAIN_BLOCKLIST = frozenset(getattr(settings, "GOOGLE_DOMAIN_BLOCKLIST", ["gmail.com"]) or [])

DATA_VERSION = "1"
