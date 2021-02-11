from sentry.plugins.bases.issue2 import IssuePlugin2


class ExampleIssueTrackingPlugin(IssuePlugin2):
    author = "Sentry Team"
    author_url = "https://github.com/getsentry/sentry"
    version = "0.0.0"
    description = "An example issue tracking plugin"
    resource_links = [
        ("Report Issue", "https://github.com/getsentry/sentry/issues"),
        ("View Source", "https://github.com/getsentry/sentry"),
    ]

    slug = "example-issue"
    title = "Example Issue Tracking"
    conf_title = title
    conf_key = "example-issue"

    def is_configured(self, request, project, **kwargs):
        return bool(self.get_option("repo", project))

    def get_new_issue_fields(self, request, group, event, **kwargs):
        fields = super().get_new_issue_fields(request, group, event, **kwargs)
        return [{"name": "tracker_url", "label": "Issue Tracker URL", "type": "text"}] + fields

    def create_issue(self, request, group, form_data, **kwargs):
        return "1"

    def get_issue_label(self, group, issue_id, **kwargs):
        return "Example-%s" % issue_id

    def get_issue_url(self, group, issue_id, **kwargs):
        tracker_url = self.get_option("tracker_url", group.project)

        return f"{tracker_url}?issueID={issue_id}"

    def get_configure_plugin_fields(self, project, **kwargs):
        return [
            {
                "name": "tracker_url",
                "label": "Issue Tracker URL",
                "type": "text",
                "placeholder": "e.g. https://example.com",
            }
        ]
