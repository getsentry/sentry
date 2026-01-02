from django.http import Http404, HttpRequest, HttpResponse

from sentry.models.group import Group, get_group_with_redirect
from sentry.models.groupmeta import GroupMeta
from sentry.services import eventstore
from sentry.utils import json
from sentry.web.frontend.base import OrganizationView, region_silo_view


@region_silo_view
class GroupEventJsonView(OrganizationView):
    required_scope = "event:read"

    def get(self, request: HttpRequest, organization, group_id, event_id_or_latest) -> HttpResponse:
        try:
            # TODO(tkaemming): This should *actually* redirect, see similar
            # comment in ``GroupEndpoint.convert_args``.
            group, _ = get_group_with_redirect(group_id, organization=organization)
        except Group.DoesNotExist:
            raise Http404

        if event_id_or_latest == "latest":
            event = group.get_latest_event()
        else:
            event = eventstore.backend.get_event_by_id(
                group.project.id, event_id_or_latest, group_id=group.id
            )

        if event is None:
            raise Http404

        GroupMeta.objects.populate_cache([group])

        return HttpResponse(json.dumps(event.as_dict()), content_type="application/json")
