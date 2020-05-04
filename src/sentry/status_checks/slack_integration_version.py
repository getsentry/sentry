from __future__ import absolute_import

from sentry import features, options
from sentry.models import OrganizationMember, OrganizationIntegration
from sentry.utils.compat import map, filter

from .base import StatusCheck, Problem


def is_wst_slack(oi):
    integration = oi.integration
    if integration.provider != "slack":
        return False
    metadata = integration.metadata
    # no installation type sent and no user access token
    return "installation_type" not in metadata and "user_access_token" not in metadata


class SlackIntegrationVersion(StatusCheck):
    def check(self, request):
        org_member_list = OrganizationMember.objects.filter(
            user=request.user, role__in=["admin", "owner", "manager"]
        ).select_related("organization")
        org_list = map(lambda m: m.organization, org_member_list)
        org_list = filter(
            lambda o: features.has("organizations:slack-migration", o, actor=request.user), org_list
        )
        org_integrations = OrganizationIntegration.objects.filter(
            organization__in=org_list
        ).select_related("integration")
        workspace_org_integrations = filter(is_wst_slack, org_integrations)
        if not workspace_org_integrations:
            return []

        # only need first org
        org = filter(lambda o: o.id == workspace_org_integrations[0].organization_id, org_list)[0]

        return [
            Problem(
                u"Click here to upgrade your Slack integration",
                severity=Problem.SEVERITY_WARNING,
                url="%s/settings/%s/integrations/slack/?tab=configurations"
                % (options.get("system.url-prefix"), org.slug),
            )
        ]
