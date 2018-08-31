from __future__ import absolute_import

from sentry.plugins import plugins, IssueTrackingPlugin2


class VstsPlugin(IssueTrackingPlugin2):
    slug = 'vsts'
    conf_key = slug


class GitHubPlugin(IssueTrackingPlugin2):
    slug = 'github'
    conf_key = slug


class BitbucketPlugin(IssueTrackingPlugin2):
    slug = 'bitbucket'
    conf_key = slug


plugins.register(VstsPlugin)
plugins.register(GitHubPlugin)
plugins.register(BitbucketPlugin)
