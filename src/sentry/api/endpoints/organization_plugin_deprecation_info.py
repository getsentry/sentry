from typing import int
from rest_framework.response import Response

from sentry.api.api_owners import ApiOwner
from sentry.api.api_publish_status import ApiPublishStatus
from sentry.api.base import region_silo_endpoint
from sentry.api.bases import OrganizationEndpoint
from sentry.constants import ObjectStatus
from sentry.db.models.manager.base_query_set import BaseQuerySet
from sentry.models.group import Group
from sentry.models.project import Project
from sentry.models.rule import Rule
from sentry.organizations.absolute_url import generate_organization_url


@region_silo_endpoint
class OrganizationPluginDeprecationInfoEndpoint(OrganizationEndpoint):
    publish_status = {
        "GET": ApiPublishStatus.PRIVATE,
    }
    owner = ApiOwner.ECOSYSTEM

    def get(self, request, organization, plugin_slug):
        """
        Returns a list of objects that are affected by a plugin deprecation. Objects could be issues or alert rules or both
        pparam: organization, plugin_slug
        """
        # Plugins in the db are stored in lowercase but there is not guarantee that's how the customer will call the API
        plugin = plugin_slug.lower()
        plugin_projects = Project.objects.filter(
            status=ObjectStatus.ACTIVE,
            organization=organization,
            projectoption__key=f"{plugin}:enabled",
            projectoption__value=True,
        ).distinct()

        url_prefix = generate_organization_url(organization.slug)
        affected_rules_urls = self.get_plugin_rules_urls(
            plugin_projects, f"{url_prefix}/organizations/{organization.slug}", plugin
        )
        affected_issue_urls = self.get_plugin_groups_urls(plugin_projects, plugin, url_prefix)

        return Response(
            {"affected_rules": affected_rules_urls, "affected_groups": affected_issue_urls}
        )

    def get_plugin_rules_urls(
        self, plugin_projects: BaseQuerySet[Project, Project], url_prefix: str, plugin: str
    ) -> list[str]:
        candidate_rules = Rule.objects.filter(
            status=ObjectStatus.ACTIVE,
            project__in=plugin_projects,
        ).distinct()

        matching_rule_urls = []

        for rule in candidate_rules:
            actions = rule.data.get("actions", [])
            for action in actions:
                if (
                    action.get("id")
                    == "sentry.rules.actions.notify_event_service.NotifyEventServiceAction"
                    and action.get("service") == plugin
                ):
                    matching_rule_urls.append(
                        f"{url_prefix}/alerts/rules/{rule.project.slug}/{rule.id}/details/"
                    )
                    break
        return matching_rule_urls

    def get_plugin_groups_urls(
        self, plugin_projects: BaseQuerySet[Project, Project], plugin: str, url_prefix: str
    ) -> list[str]:
        groups_with_plugin_meta = (
            Group.objects.filter(
                project__in=plugin_projects,
                groupmeta__key__contains=f"{plugin}:tid",
            )
            .distinct()
            .select_related("project")
        )

        affected_groups_urls = []
        for group in groups_with_plugin_meta:
            affected_groups_urls.append(f"{url_prefix}/issues/{group.id}/")

        return affected_groups_urls
