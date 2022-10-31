from __future__ import annotations

from typing import TYPE_CHECKING

from rest_framework.request import Request
from rest_framework.response import Response

from sentry import tagstore
from sentry.api.base import region_silo_endpoint
from sentry.api.bases.group import GroupEndpoint
from sentry.api.helpers.environments import get_environments
from sentry.api.helpers.mobile import get_readable_device_name
from sentry.api.serializers import serialize

if TYPE_CHECKING:
    from sentry.models import Group


@region_silo_endpoint
class GroupTagsEndpoint(GroupEndpoint):  # type: ignore
    def get(self, request: Request, group: Group) -> Response:

        # optional queryparam `key` can be used to get results
        # only for specific keys.
        keys = [tagstore.prefix_reserved_key(k) for k in request.GET.getlist("key") if k] or None

        # There are 2 use-cases for this method. For the 'Tags' tab we
        # get the top 10 values, for the tag distribution bars we get 9
        # This should ideally just be specified by the client
        if keys:
            value_limit = 9
        else:
            value_limit = 10

        environment_ids = [e.id for e in get_environments(request, group.project.organization)]

        tag_keys = tagstore.get_group_tag_keys_and_top_values(
            group, environment_ids, keys=keys, value_limit=value_limit
        )

        data = serialize(tag_keys, request.user)

        show_readable_tag_values = request.GET.get("readable")
        if show_readable_tag_values:
            add_readable_tag_values(data)

        return Response(data)


def add_readable_tag_values(data):
    # Map device tag to a more readable value if possible
    device_tag = next((tag for tag in data if tag["key"] == "device"), None)
    for top_device in device_tag["topValues"]:
        readable_value = get_readable_device_name(top_device["value"])
        if readable_value:
            top_device["readable"] = readable_value
