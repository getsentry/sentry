from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.models.rule import Rule


@region_silo_endpoint
class OrganizationPluginDeprecationInfoEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ECOSYSTEM

    def get(self, request, organization):
        """
        Returns a list of objects that are affected by a plugin deprecation. Objects could be issues or alert rules or both
        pparam: organization
        qparam: plugin -> plugin slug
        """
        # Get plugin query parameter
        plugin = request.GET.get("plugin")

        candidate_rules = Rule.objects.filter(
            status=ObjectStatus.ACTIVE,
            project__status=ObjectStatus.ACTIVE,
            project__organization=organization,
            project__projectoption__key=f"{plugin}:enabled",
            project__projectoption__value=True,
            # rulefirehistory__date__gte=timezone.now() - timedelta(days=30),
        ).distinct()

        matching_rule_ids = []
        for rule in candidate_rules:
            actions = rule.data.get("actions", [])
            for action in actions:
                if (
                    action.get("id")
                    == "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
                    and action.get("service") == plugin
                ):
                    matching_rule_ids.append(rule.id)
                    break

        return Response({"affected_rules": matching_rule_ids})
