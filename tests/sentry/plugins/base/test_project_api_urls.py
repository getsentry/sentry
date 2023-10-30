from django.urls import re_path

from sentry.plugins.base.project_api_urls import load_plugin_urls
from sentry.plugins.base.v2 import Plugin2


def test_load_plugin_project_urls():
    class BadPluginA(Plugin2):
        def get_project_urls(self):
            return [("foo", "bar")]

    class BadPluginB(Plugin2):
        def get_project_urls(self):
            return "lol"

    class BadPluginC(Plugin2):
        def get_project_urls(self):
            return None

    class GoodPluginA(Plugin2):
        def get_project_urls(self):
            # XXX: Django 1.10 requires a view callable. I was too lazy to figure out
            # how to mock one, so just using this random low-level thing.
            # As far as I can see, none of our plugins use get_project_urls, so
            # all this can probably even be removed, but I'm keeping it here for now
            # for fear of breakage.
            from django.views.generic.list import BaseListView

            return [re_path("", BaseListView.as_view())]

    patterns = load_plugin_urls((BadPluginA(), BadPluginB(), BadPluginC(), GoodPluginA()))

    assert len(patterns) == 1


def test_load_plugin_group_urls():
    from sentry.plugins.base.group_api_urls import load_plugin_urls
    from sentry_plugins.asana.plugin import AsanaPlugin
    from sentry_plugins.bitbucket.plugin import BitbucketPlugin
    from sentry_plugins.github.plugin import GitHubPlugin
    from sentry_plugins.jira.plugin import JiraPlugin
    from sentry_plugins.phabricator.plugin import PhabricatorPlugin
    from sentry_plugins.pivotal.plugin import PivotalPlugin

    patterns = load_plugin_urls(
        (
            JiraPlugin(),
            GitHubPlugin(),
            PivotalPlugin(),
            BitbucketPlugin(),
            AsanaPlugin(),
            PhabricatorPlugin(),
        )
    )

    assert len(patterns) == 6
