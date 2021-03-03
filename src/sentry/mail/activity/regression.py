from sentry.utils.html import escape
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


class RegressionActivityEmail(ActivityEmail):
    def get_activity_name(self):
        return "Regression"

    def get_description(self):
        data = self.activity.data

        if data.get("version"):
            version_url = "/organizations/{}/releases/{}/".format(
                self.organization.slug, data["version"]
            )

            return (
                "{author} marked {an issue} as a regression in {version}",
                {"version": data["version"]},
                {
                    "version": '<a href="{}">{}</a>'.format(
                        absolute_uri(version_url), escape(data["version"])
                    )
                },
            )

        return "{author} marked {an issue} as a regression"

    def get_category(self):
        return "regression_activity_email"
