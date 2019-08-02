from __future__ import absolute_import


def get_support_mail():
    """Returns the most appropriate support email address"""
    from sentry.options import get

    return get("system.support-email") or get("system.admin-email") or None
