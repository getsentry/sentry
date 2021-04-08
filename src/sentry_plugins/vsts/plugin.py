""" A plugin to incorporate work-item creation in VSTS
easily out of issues detected from Sentry.io """


from mistune import markdown

from sentry.integrations import FeatureDescription, IntegrationFeatures
from sentry.plugins.bases.issue2 import IssueTrackingPlugin2
from sentry.utils.http import absolute_uri

from .mixins import VisualStudioMixin
from .repository_provider import VisualStudioRepositoryProvider


class VstsPlugin(VisualStudioMixin, IssueTrackingPlugin2):
    description = "Integrate Visual Studio Team Services work items by linking a project."
    slug = "vsts"
    conf_key = slug
    auth_provider = "visualstudio"
    required_field = "instance"
    feature_descriptions = [
        FeatureDescription(
            """
            Authorize repositories to be added to your Sentry organization to augment
            sentry issues with commit data with [deployment
            tracking](https://docs.sentry.io/learn/releases/).
            """,
            IntegrationFeatures.COMMITS,
        ),
        FeatureDescription(
            """
            Create and link Sentry issue groups directly to a Azure DevOps work item in any of
            your projects, providing a quick way to jump from Sentry bug to tracked
            work item!
            """,
            IntegrationFeatures.ISSUE_BASIC,
        ),
    ]

    issue_fields = frozenset(["id", "title", "url"])

    def get_configure_plugin_fields(self, request, project, **kwargs):
        # TODO(dcramer): Both Account and Project can query the API an access
        # token, and could likely be moved to the 'Create Issue' form
        return [
            {
                "name": "instance",
                "label": "Instance",
                "type": "text",
                "placeholder": "example.visualstudio.com",
                "required": True,
                "help": "VS Team Services account ({account}.visualstudio.com) or TFS server ({server:port}).",
            },
            {
                "name": "default_project",
                "label": "Default Project Name",
                "type": "text",
                "placeholder": "MyProject",
                "required": False,
                "help": (
                    "Enter the Visual Studio Team Services project name that you wish "
                    "to use as a default for new work items"
                ),
            },
        ]

    def is_configured(self, request, project, **kwargs):
        for o in ("instance",):
            if not bool(self.get_option(o, project)):
                return False
        return True

    def get_issue_label(self, group, issue, **kwargs):
        return "Bug {}".format(issue["id"])

    def get_issue_url(self, group, issue, **kwargs):
        return issue["url"]

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super().get_new_issue_fields(request, group, event, **kwargs)
        client = self.get_client(request.user)
        instance = self.get_option("instance", group.project)

        try:
            projects = client.get_projects(instance)
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return [
            {
                "name": "project",
                "label": "Project",
                "default": self.get_option("default_project", group.project),
                "type": "text",
                "choices": [i["name"] for i in projects["value"]],
                "required": True,
            }
        ] + fields

    def get_link_existing_issue_fields(self, request, group, event, **kwargs):
        return [
            {"name": "item_id", "label": "Work Item ID", "default": "", "type": "text"},
            {
                "name": "comment",
                "label": "Comment",
                "default": "I've identified this issue in Sentry: {}".format(
                    absolute_uri(group.get_absolute_url(params={"referrer": "vsts_plugin"}))
                ),
                "type": "textarea",
                "help": ("Markdown is supported. Leave blank if you don't want to add a comment."),
                "required": False,
            },
        ]

    def create_issue(self, request, group, form_data, **kwargs):
        """
        Creates the issue on the remote service and returns an issue ID.
        """
        instance = self.get_option("instance", group.project)
        project = form_data.get("project") or self.get_option("default_project", group.project)

        client = self.get_client(request.user)

        title = form_data["title"]
        description = form_data["description"]
        link = absolute_uri(group.get_absolute_url(params={"referrer": "vsts_plugin"}))
        try:
            created_item = client.create_work_item(
                instance=instance,
                project=project,
                title=title,
                comment=markdown(description),
                link=link,
            )
        except Exception as e:
            self.raise_error(e, identity=client.auth)

        return {
            "id": created_item["id"],
            "url": created_item["_links"]["html"]["href"],
            "title": title,
        }

    def link_issue(self, request, group, form_data, **kwargs):
        client = self.get_client(request.user)
        instance = self.get_option("instance", group.project)
        if form_data.get("comment"):
            try:
                work_item = client.update_work_item(
                    instance=instance,
                    id=form_data["item_id"],
                    link=absolute_uri(group.get_absolute_url(params={"referrer": "vsts_plugin"})),
                    comment=markdown(form_data["comment"]) if form_data.get("comment") else None,
                )
            except Exception as e:
                self.raise_error(e, identity=client.auth)
        else:
            try:
                work_item = client.get_work_item(instance=instance, id=form_data["item_id"])
            except Exception as e:
                self.raise_error(e, identity=client.auth)

        return {
            "id": work_item["id"],
            "url": work_item["_links"]["html"]["href"],
            "title": work_item["fields"]["System.Title"],
        }

    def setup(self, bindings):
        bindings.add("repository.provider", VisualStudioRepositoryProvider, id="visualstudio")
