from sentry.plugins.base.group_api_urls import load_plugin_urls
from sentry_plugins.asana.plugin import AsanaPlugin
from sentry_plugins.bitbucket.plugin import BitbucketPlugin
from sentry_plugins.github.plugin import GitHubPlugin
from sentry_plugins.jira.plugin import JiraPlugin
from sentry_plugins.pivotal.plugin import PivotalPlugin


def test_load_plugin_group_urls() -> None:
    patterns = load_plugin_urls(
        (
            JiraPlugin(),
            GitHubPlugin(),
            PivotalPlugin(),
            BitbucketPlugin(),
            AsanaPlugin(),
        )
    )

    assert len(patterns) == 5
