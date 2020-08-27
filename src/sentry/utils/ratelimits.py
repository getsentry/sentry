from __future__ import absolute_import

import six

from sentry import features
from sentry.app import ratelimiter
from sentry.utils.hashlib import md5_text


def for_organization_member_invite(organization, email, user=None, auth=None):
    """
    Rate limit logic for triggering a user invite email, which should also be applied for generating
    a brand new member invite when possible.
    """
    if not features.has("organizations:invite-members-rate-limits", organization, actor=user):
        return False

    limits = (
        ratelimiter.is_limited(
            u"members:invite-by-user:{}".format(
                md5_text(user.id if user and user.is_authenticated() else six.text_type(auth))
            ),
            # 100 invites from a user per day
            limit=100,
            window=3600 * 24,
        )
        if (user or auth)
        else None,
        ratelimiter.is_limited(
            u"members:invite-by-org:{}".format(md5_text(organization.id)),
            # 100 invites from an org per day
            limit=100,
            window=3600 * 24,
        ),
        ratelimiter.is_limited(
            u"members:org-invite-to-email:{}-{}".format(
                organization.id, md5_text(email.lower()).hexdigest()
            ),
            # 10 invites per email per org per day
            limit=10,
            window=3600 * 24,
        ),
    )
    return any(limits)
