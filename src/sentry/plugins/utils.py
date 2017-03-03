from __future__ import absolute_import

from sentry.plugins import IssueTrackingPlugin2


class TestIssuePlugin2(IssueTrackingPlugin2):
    """This is only used in tests."""
    slug = 'issuetrackingplugin2'
