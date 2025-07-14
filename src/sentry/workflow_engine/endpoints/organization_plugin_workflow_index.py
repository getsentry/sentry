from rest_framework.request import Request

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.api.exceptions import ResourceDoesNotExist
from sentry.api.paginator import OffsetPaginator
from sentry.api.serializers import serialize
from sentry.workflow_engine.models import Workflow

# Maps API field name to database field name, with synthetic aggregate fields keeping
# to our field naming scheme for consistency.
SORT_COL_MAP = {
    "name": "name",
    "id": "id",
    "dateCreated": "date_added",
    "dateUpdated": "date_updated",
    "connectedDetectors": "connected_detectors",
    "actions": "actions",
    "lastTriggered": "last_triggered",
}


class OrganizationWorkflowEndpoint(OrganizationEndpoint):
    def convert_args(self, request: Request, workflow_id, *args, **kwargs):
        args, kwargs = super().convert_args(request, *args, **kwargs)
        try:
            kwargs["workflow"] = Workflow.objects.get(
                organization=kwargs["organization"], id=workflow_id
            )
        except Workflow.DoesNotExist:
            raise ResourceDoesNotExist

        return args, kwargs


@region_silo_endpoint
class OrganizationPluginWorkflowIndexEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ECOSYSTEM

    def get(self, request, organization):
        """
        Returns a list of workflows that have plugin actions for a given org
        pparam: organization
        qparam: plugin -> plugin slug
        """
        # Get plugin query parameter
        plugin = request.GET.get("plugin")

        # Filter workflows that have plugin actions, they're called webhooks in the model
        queryset = Workflow.objects.filter(
            organization_id=organization.id,
            workflowactionconditiongroup__condition_group__action__type="webhook",
        )

        # If plugin parameter is provided, filter by target_id
        if plugin:
            queryset = queryset.filter(
                workflowactionconditiongroup__condition_group__action__target_id=plugin
            )

        queryset = queryset.distinct()

        # Handle sorting
        sort_by = request.GET.get("sort", "dateCreated")
        if sort_by.startswith("-"):
            order_by = f"-{SORT_COL_MAP.get(sort_by[1:], 'date_added')}"
        else:
            order_by = SORT_COL_MAP.get(sort_by, "date_added")

        return self.paginate(
            request=request,
            queryset=queryset,
            order_by=order_by,
            paginator_cls=OffsetPaginator,
            on_results=lambda x: serialize(x, request.user),
        )
