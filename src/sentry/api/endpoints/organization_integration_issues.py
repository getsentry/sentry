from django.db import IntegrityError, transaction
from rest_framework.request import Request
from rest_framework.response import Response

# from sentry import features
from sentry.api.bases.organization_integrations import OrganizationIntegrationBaseEndpoint
from sentry.models import ExternalIssue, Group, GroupLink, GroupMeta, Project, ProjectOption


class OrganizationIntegrationIssuesEndpoint(OrganizationIntegrationBaseEndpoint):
    def get(self, request: Request, organization, integration_id) -> Response:
        # todo this should be a put or a task or something idk?? just doing get so I can easily hit in the browser for now
        """
        Migrate plugin linked issues to integration linked issues
        ````````````````````````````````````````````````````````
        :pparam string organization: the slug of the organization the integration is installed in
        :pparam string integration_id: the id of the integration
        """
        integration = self.get_integration(organization, integration_id)

        for project in Project.objects.filter(organization_id=organization.id):
            plugin_options = ProjectOption.objects.filter(
                project=project.id, key__startswith="jira"
            )
            # hard coding jira seems weird for this endpoint but I'm not sure what else to do here, qparam?
            # except this isn't meant for anything else
            options_dict = {}
            for p in plugin_options:
                options_dict[p.key] = p.value

            # TODO check if the integration provider matches the instance URL, exit early if not
            groups = Group.objects.filter(project=project.id)
            # this seems expensive but I'm not sure how else to go about it
            plugin_issues = GroupMeta.objects.filter(
                key="jira:tid", group__id__in=[group.id for group in groups]
            )
            for plugin_issue in plugin_issues:
                group = Group.objects.get(id=plugin_issue.group_id)
                external_issue, created = ExternalIssue.objects.get_or_create(
                    organization_id=organization.id,
                    integration_id=integration.id,
                    key=plugin_issue.value,
                )

                try:
                    with transaction.atomic():
                        GroupLink.objects.create(
                            group_id=group.id,
                            project_id=group.project_id,
                            linked_type=GroupLink.LinkedType.issue,
                            linked_id=external_issue.id,
                            relationship=GroupLink.Relationship.references,
                        )
                except IntegrityError:
                    return Response(
                        {"non_field_errors": ["That issue is already linked"]}, status=400
                    )

                plugin_issue.delete()

            # if options_dict.get("jira:auto_create") == True:
            #     if features.has("organizations:integrations-ticket-rules", organization):
            #         create_jira_migration_alert_rule()
            # TODO create alert rule
            # may want to hit some Jira endpoints to ensure availability first?

            # disable plugin
            if options_dict.get("jira:enabled") is True:
                ProjectOption.objects.set_value(project, "jira:enabled", False)

        return Response(status=204)
