from __future__ import absolute_import

try:
    VERSION = __import__("pkg_resources").get_distribution("sentry-plugins").version
except Exception:
    VERSION = "unknown"
