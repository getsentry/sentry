from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class ResolvedInReleaseActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return "Resolved Issue"

    def get_description(self):
        data = self.activity.data

        url = "/organizations/{}/releases/{}/?project={}".format(
            self.organization.slug, data["version"], self.project.id
        )

        if data.get("version"):
            return (
                "{author} marked {an issue} as resolved in {version}",
                {"version": data["version"]},
                {
                    "version": '<a href="{}">{}</a>'.format(
                        absolute_uri(url), escape(data["version"])
                    )
                },
            )
        return "{author} marked {an issue} as resolved in an upcoming release"

    def get_category(self):
        return "resolved_in_release_activity_email"
