"""
sudo.settings
~~~~~~~~~~~~~

:copyright: (c) 2020 by Matt Robenolt.
:license: BSD, see LICENSE for more details.
"""

from django.conf import settings

# How long should sudo mode be active for? Duration in seconds.
COOKIE_AGE = getattr(settings, "SUDO_COOKIE_AGE", 10800)

# The domain to bind the sudo cookie to. Default to the current domain.
COOKIE_DOMAIN = getattr(settings, "SUDO_COOKIE_DOMAIN", settings.SESSION_COOKIE_DOMAIN)

# Should the cookie only be accessible via http requests?
# Note: If this is set to False, any JavaScript files have the ability to access
# this cookie, so this should only be changed if you have a good reason to do so.
COOKIE_HTTPONLY = getattr(settings, "SUDO_COOKIE_HTTPONLY", True)

# The name of the cookie to be used for sudo mode.
COOKIE_NAME = getattr(settings, "SUDO_COOKIE_NAME", "sudo")

# Restrict the sudo cookie to a specific path.
COOKIE_PATH = getattr(settings, "SUDO_COOKIE_PATH", "/")

# Only transmit the sudo cookie over https if True.
# By default, this will match the current protocol. If your site is
# https already, this will be True.
COOKIE_SECURE = getattr(settings, "SUDO_COOKIE_SECURE", None)

# An extra salt to be added into the cookie signature
COOKIE_SALT = getattr(settings, "SUDO_COOKIE_SALT", "")
