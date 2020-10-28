from __future__ import absolute_import

from sentry.plugins.bases import IssueTrackingPlugin2
from sentry.integrations import FeatureDescription, IntegrationFeatures


class TestIssuePlugin2(IssueTrackingPlugin2):
    """This is only used in tests."""

    slug = "issuetrackingplugin2"
    feature_descriptions = [
        FeatureDescription(
            """
            Create issues
            """,
            IntegrationFeatures.ISSUE_BASIC,
        )
    ]
