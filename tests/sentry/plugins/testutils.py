from __future__ import absolute_import

from sentry.plugins.base import plugins
from sentry.plugins.bases import IssueTrackingPlugin2


class VstsPlugin(IssueTrackingPlugin2):
    slug = "vsts"
    name = "VSTS Mock Plugin"
    conf_key = slug


class GitHubPlugin(IssueTrackingPlugin2):
    slug = "github"
    name = "GitHub Mock Plugin"
    conf_key = slug


class BitbucketPlugin(IssueTrackingPlugin2):
    slug = "bitbucket"
    name = "Bitbucket Mock Plugin"
    conf_key = slug


def unregister_mock_plugins():
    plugins.unregister(VstsPlugin)
    plugins.unregister(GitHubPlugin)
    plugins.unregister(BitbucketPlugin)


def register_mock_plugins():
    plugins.register(VstsPlugin)
    plugins.register(GitHubPlugin)
    plugins.register(BitbucketPlugin)
