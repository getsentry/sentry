from __future__ import absolute_import

import six

from sentry import features
from sentry.app import ratelimiter
from sentry.utils.hashlib import md5_text

DEFAULT_CONFIG = {
    # 100 invites from a user per day
    "members:invite-by-user": {"limit": 100, "window": 3600 * 24},
    # 100 invites from an org per day
    "members:invite-by-org": {"limit": 100, "window": 3600 * 24},
    # 10 invites per email per org per day
    "members:org-invite-to-email": {"limit": 10, "window": 3600 * 24},
}


def for_organization_member_invite(organization, email, user=None, auth=None, config=None):
    """
    Rate limit logic for triggering a user invite email, which should also be applied for generating
    a brand new member invite when possible.
    """
    if config is None:
        config = DEFAULT_CONFIG

    if not features.has("organizations:invite-members-rate-limits", organization, actor=user):
        return False

    limits = (
        ratelimiter.is_limited(
            u"members:invite-by-user:{}".format(
                md5_text(
                    user.id if user and user.is_authenticated() else six.text_type(auth)
                ).hexdigest()
            ),
            **config["members:invite-by-user"]
        )
        if (user or auth)
        else None,
        ratelimiter.is_limited(
            u"members:invite-by-org:{}".format(md5_text(organization.id).hexdigest()),
            **config["members:invite-by-org"]
        ),
        ratelimiter.is_limited(
            u"members:org-invite-to-email:{}-{}".format(
                organization.id, md5_text(email.lower()).hexdigest()
            ),
            **config["members:org-invite-to-email"]
        ),
    )
    return any(limits)
