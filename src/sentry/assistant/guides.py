from __future__ import absolute_import

from django.utils.translation import ugettext_lazy as _


# Guide Schema
# id (text, required): unique id
# required_targets (list): An empty list will cause the guide to be shown regardless
#                          of page/targets presence.
# steps (list): List of steps

# Step Schema
# title (text, required): Title text. Tone should be active.
# message (text, optional): Message text. Should help illustrate how to do a task, not
#                           just literally what the button does.
# target (text, optional): step is tied to an anchor target. If the anchor doesn't exist,
#                          the step will not be shown. if the anchor exists but is of type
#                         "invisible", it will not be pinged but will be scrolled to.
#                          otherwise the anchor will be pinged and scrolled to. If you'd like
#                          your step to show always or have a step is not tied to a specific
#                          element but you'd still like it to be shown, set this as None.

GUIDES = {
    "issue": {
        "id": 1,
        "required_targets": ["issue_title", "exception"],
        "steps": [
            {
                "title": _("Issue Details"),
                "message": _(
                    "The issue page contains all the details about an issue. Let's get started."
                ),
                "target": "issue_title",
            },
            {
                "title": _("Stacktrace"),
                "message": _(
                    "See the sequence of function calls that led to the error, and "
                    "global/local variables for each stack frame."
                ),
                "target": "exception",
            },
            {
                "title": _("Breadcrumbs"),
                "message": _(
                    "Breadcrumbs are a trail of events that happened prior to the error. They're "
                    "similar to traditional logs but can record more rich structured data. "
                    "When Sentry is used with web frameworks, breadcrumbs are automatically "
                    "captured for events like database calls and network requests."
                ),
                "target": "breadcrumbs",
            },
            {
                "title": _("Tags"),
                "message": _(
                    "Attach arbitrary key-value pairs to each event which you can search and filter on. "
                    "View a heatmap of all tags for an issue on the right panel. "
                ),
                "target": "tags",
            },
            {
                "title": _("Resolve"),
                "message": _(
                    "Resolve an issue to remove it from your issue list. "
                    'Sentry can also <a href="/settings/account/notifications/" target="_blank"> '
                    "alert you</a> when a new issue occurs or a resolved issue re-occurs."
                ),
                "target": "resolve",
            },
            {
                "title": _("Delete and Ignore"),
                "message": _(
                    "Delete an issue to remove it from your issue list until it happens again. "
                    "Ignore an issue to remove it permanently or until certain conditions are met."
                ),
                "target": "ignore_delete_discard",
            },
            {
                "title": _("Issue Number"),
                "message": _(
                    "Include this unique identifier in your commit message to have Sentry automatically "
                    "resolve the issue when your code is deployed. "
                    '<a href="https://docs.sentry.io/learn/releases/" target="_blank">Learn more</a>.'
                ),
                "target": "issue_number",
            },
            {
                "title": _("Ownership Rules"),
                "message": _(
                    "Define users or teams responsible for specific file paths or URLs so "
                    "that alerts can be routed to the right person. "
                    '<a href="https://docs.sentry.io/learn/issue-owners/" target="_blank">Learn more</a>.'
                ),
                "target": "owners",
            },
        ],
    },
    "issue_stream": {
        "id": 3,
        "required_targets": ["issue_stream"],
        "steps": [
            {
                "title": _("Issues"),
                "message": _(
                    "Sentry automatically groups similar events together into an issue. Similarity "
                    "is determined by stacktrace and other factors. "
                    '<a href="https://docs.sentry.io/data-management/rollups/" target="_blank">Learn more</a>. '
                ),
                "target": "issue_stream",
            }
        ],
    },
    "dynamic_counts": {"id": 7, "required_targets": ["dynamic_counts"]},
}
