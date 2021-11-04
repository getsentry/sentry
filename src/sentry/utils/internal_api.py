from __future__ import annotations

from typing import Literal

from django.urls import reverse

from sentry.api import client
from sentry.models import OrganizationMember, User


def update_member_invitation_status(
    member: OrganizationMember,
    user: User,
    action: Literal["reject_member", "approve_member"],
):
    # payload and method differ if we reject or accept
    method = "DELETE" if action == "reject_member" else "PUT"
    action_data = (
        {}
        if action == "reject_member"
        else {
            "approve": 1,
        }
    )

    url = reverse(
        "sentry-api-0-organization-invite-request-detail",
        args=[member.organization.slug, member.id],
    )

    return client.request(
        method,
        path=url,
        data=action_data,
        user=user,
    )
