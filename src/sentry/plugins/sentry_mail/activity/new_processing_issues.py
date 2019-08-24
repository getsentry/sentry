from __future__ import absolute_import

from sentry.models import GroupSubscriptionReason, EventError
from sentry.utils.http import absolute_uri

from .base import ActivityEmail


def summarize_issues(issues):
    rv = []
    for issue in issues:
        extra_info = None
        msg_d = dict(issue["data"])
        msg_d["type"] = issue["type"]

        if "image_path" in issue["data"]:
            extra_info = issue["data"]["image_path"].rsplit("/", 1)[-1]
            if "image_arch" in issue["data"]:
                extra_info = "%s (%s)" % (extra_info, issue["data"]["image_arch"])

        rv.append({"message": EventError(msg_d).message, "extra_info": extra_info})
    return rv


class NewProcessingIssuesActivityEmail(ActivityEmail):
    def __init__(self, activity):
        ActivityEmail.__init__(self, activity)
        self.issues = summarize_issues(self.activity.data["issues"])

    def get_participants(self):
        return dict(
            (user, GroupSubscriptionReason.processing_issue)
            for user in self.project.get_mail_alert_subscribers()
        )

    def get_context(self):
        return {
            "project": self.project,
            "issues": self.issues,
            "reprocessing_active": self.activity.data["reprocessing_active"],
            "info_url": absolute_uri(
                u"/settings/{}/projects/{}/processing-issues/".format(
                    self.organization.slug, self.project.slug
                )
            ),
        }

    def get_subject(self):
        return u"Processing Issues on {}".format(self.project.slug)

    def get_template(self):
        return "sentry/emails/activity/new_processing_issues.txt"

    def get_html_template(self):
        return "sentry/emails/activity/new_processing_issues.html"
