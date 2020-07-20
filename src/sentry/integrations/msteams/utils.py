from __future__ import absolute_import

from sentry.models import Integration
from sentry.utils.compat import filter
from .client import MsTeamsClient

MSTEAMS_MAX_ITERS = 100


def channel_filter(channel, name):
    # the general channel has no name in the list
    # retrieved from the REST API call
    if channel.get("name"):
        return name == channel.get("name")
    else:
        return name == "General"


def get_channel_id(organization, integration_id, name):
    try:
        integration = Integration.objects.get(
            provider="msteams", organizations=organization, id=integration_id
        )
    except Integration.DoesNotExist:
        return None

    team_id = integration.external_id
    client = MsTeamsClient(integration)

    # handle searching for channels first
    channel_list = client.get_channel_list(team_id)
    filtered_channels = list(filter(lambda x: channel_filter(x, name), channel_list))
    if len(filtered_channels) > 0:
        return filtered_channels[0].get("id")

    # handle searching for users
    members = client.get_member_list(team_id, None)
    for i in range(MSTEAMS_MAX_ITERS):
        member_list = members.get("members")
        continuation_token = members.get("continuationToken")

        filtered_members = list(filter(lambda x: x.get("name") == name, member_list))
        if len(filtered_members) > 0:
            # TODO: handle duplicate username case
            user_id = filtered_members[0].get("id")
            tenant_id = filtered_members[0].get("tenantId")
            return client.get_user_conversation_id(user_id, tenant_id)

        if not continuation_token:
            return None

        members = client.get_member_list(team_id, continuation_token)

    return None
