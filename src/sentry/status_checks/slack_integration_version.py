from __future__ import absolute_import

import random
from sentry import features, options
from sentry.models import OrganizationMember, OrganizationIntegration
from sentry.utils.compat import map, filter
from sentry.utils import metrics

from .base import StatusCheck, Problem


def is_wst_slack(oi):
    integration = oi.integration
    if integration.provider != "slack":
        return False
    metadata = integration.metadata
    # no installation type sent and no user access token
    return "installation_type" not in metadata and "user_access_token" not in metadata


class SlackIntegrationVersion(StatusCheck):
    def should_run_queries(self):
        # using sampling here so we can slowly increase the load here
        # can look into caching if this becomes a performance problem with high sampling rates
        enable_check = options.get("slack-migration.enable-banner-check")
        return enable_check and random.random() < options.get("slack-migration.banner-sample-rate")

    def check(self, request):
        metrics.incr("slack_migration.check_should_run_queries", sample_rate=1.0)
        if not self.should_run_queries():
            return []

        # only show banner if user is an admin, owner, or manager
        org_member_list = OrganizationMember.objects.filter(
            user=request.user, role__in=["admin", "owner", "manager"]
        ).select_related("organization")
        if not org_member_list:
            return []

        # find workspace slack integrations for orgs in org_member_list
        org_list = map(lambda m: m.organization, org_member_list)
        org_integrations = OrganizationIntegration.objects.filter(
            organization__in=org_list
        ).select_related("integration")
        workspace_org_integrations = filter(is_wst_slack, org_integrations)
        if not workspace_org_integrations:
            return []

        # get the org ids of orgs that have a workspace slack installation
        matching_org_ids = map(lambda oi: oi.organization_id, workspace_org_integrations)

        # check the feature flag downstream so we can run all the queries even if the user doesn't see the banner
        def is_matching_org(org):
            if org.id not in matching_org_ids:
                return False
            # filter out integrations that don't have the feature enabled
            return features.has("organizations:slack-migration", org, actor=request.user)

        matching_orgs = filter(is_matching_org, org_list)
        if not matching_orgs:
            return []

        # only need first org
        org = matching_orgs[0]

        return [
            Problem(
                u"Click here to upgrade your Slack integration",
                severity=Problem.SEVERITY_WARNING,
                url="/settings/%s/integrations/slack/?tab=configurations" % (org.slug),
            )
        ]
