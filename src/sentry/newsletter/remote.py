from __future__ import absolute_import

import logging
from uuid import uuid4
from hashlib import sha1

from sentry.http import safe_urlopen
from sentry.newsletter.base import Newsletter
from sentry.utils import json

logger = logging.getLogger("sentry.newsletter")


def get_install_id():
    from sentry import options

    install_id = options.get("sentry:install-id")
    if not install_id:
        install_id = sha1(uuid4().bytes).hexdigest()
        options.set("sentry:install-id", install_id)
    return install_id


class RemoteNewsletter(Newsletter):
    enabled = True
    endpoint = "https://sentry.io/remote/newsletter/subscription/"

    def __init__(self, endpoint=None):
        if endpoint is not None:
            self.endpoint = endpoint

    def update_subscription(self, user, **kwargs):
        kwargs["user_id"] = user.id
        kwargs["email"] = user.email
        kwargs["referral"] = "onpremise"
        kwargs["install_id"] = get_install_id()
        try:
            response = safe_urlopen(
                self.endpoint,
                method="POST",
                headers={"Content-Type": "application/json"},
                data=json.dumps(kwargs),
            )
            response.raise_for_status()
            return response.json()
        except Exception:
            logger.exception("update.failed")
            return None

    def get_subscriptions(self, user):
        try:
            response = safe_urlopen(
                self.endpoint,
                method="GET",
                params={"user_id": user.id, "install_id": get_install_id()},
            )
            response.raise_for_status()
            return response.json()
        except Exception:
            logger.exception("fetch.failed")
            return None
