from __future__ import absolute_import

import six

from rest_framework.response import Response

from sentry import eventstore
from sentry.app import ratelimiter
from sentry.api.base import DocSection
from sentry.api.bases.organization import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.serializers import serialize
from sentry.models import Project
from sentry.utils.apidocs import scenario, attach_scenarios
from sentry.utils.hashlib import md5_text


@scenario("ResolveEventId")
def resolve_event_id_scenario(runner):
    runner.request(
        method="GET",
        path="/organizations/%s/eventids/%s/" % (runner.org.slug, runner.default_event.event_id),
    )


class EventIdLookupEndpoint(OrganizationEndpoint):
    doc_section = DocSection.ORGANIZATIONS

    @attach_scenarios([resolve_event_id_scenario])
    def get(self, request, organization, event_id):
        """
        Resolve a Event ID
        ``````````````````

        This resolves a event ID to the project slug and internal issue ID and internal event ID.

        :pparam string organization_slug: the slug of the organization the
                                          event ID should be looked up in.
        :param string event_id: the event ID to look up.
        :auth: required
        """
        # Largely copied from ProjectGroupIndexEndpoint
        if len(event_id) != 32:
            return Response({"detail": "Event ID must be 32 characters."}, status=400)

        # Limit to 1 req/s
        if ratelimiter.is_limited(
            u"api:event-id-lookup:{}".format(
                md5_text(
                    request.user.id if request.user and request.user.is_authenticated() else ""
                ).hexdigest()
            ),
            limit=1,
            window=1,
        ):
            return Response(
                {
                    "detail": "You are attempting to use this endpoint too quickly. Limit is 1 request per second."
                },
                status=429,
            )

        project_slugs_by_id = dict(
            Project.objects.filter(organization=organization).values_list("id", "slug")
        )

        try:
            snuba_filter = eventstore.Filter(
                conditions=[["event.type", "!=", "transaction"]],
                project_ids=list(project_slugs_by_id.keys()),
                event_ids=[event_id],
            )
            event = eventstore.get_events(filter=snuba_filter, limit=1)[0]
        except IndexError:
            raise ResourceDoesNotExist()
        else:
            return Response(
                {
                    "organizationSlug": organization.slug,
                    "projectSlug": project_slugs_by_id[event.project_id],
                    "groupId": six.text_type(event.group_id),
                    "eventId": six.text_type(event.event_id),
                    "event": serialize(event, request.user),
                }
            )
