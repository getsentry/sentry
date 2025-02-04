from django.conf import settings

from sentry.plugins.base import plugins
from sentry.runner.importer import install_plugin_apps
from sentry.testutils.cases import TestCase

plugin_slugs = [
    "amazon-sqs",
    "asana",
    "bitbucket",
    "browsers",
    "device",
    "github",
    "gitlab",
    "heroku",
    "interface_types",
    "javaplugin",
    "javascriptplugin",
    "jira",
    "opsgenie",
    "os",
    "pagerduty",
    "pivotal",
    "pushover",
    "redmine",
    "segment",
    "sessionstack",
    "slack",
    "splunk",
    "trello",
    "twilio",
    "urls",
    "victorops",
    "webhooks",
]


sentry_app_names = [
    "auth_github",
    "auth_saml2.onelogin",
    "auth_saml2.generic",
    "auth_saml2.okta",
    "auth_saml2.rippling",
    "auth_saml2.auth0",
    "jira",
    "opsgenie",
    "redmine",
    "sessionstack",
    "trello",
    "twilio",
]


class TestPluginsInstalled(TestCase):
    def test_plugin_slugs(self):
        all_plugins = sorted(plugin.slug for plugin in plugins.all(version=None))
        # issuetrackingplugin2 is a test plugin from sentry pytest utils
        all_plugins.remove("issuetrackingplugin2")
        assert all_plugins == plugin_slugs

    def test_sentry_apps(self):
        install_plugin_apps("sentry.apps", settings)

        normalized_apps = set(
            map(
                lambda x: x.replace("sentry_plugins.", "")
                .replace("sentry.auth.providers.", "auth_")
                .replace("sentry_", ""),
                settings.INSTALLED_APPS,
            )
        )

        for app in sentry_app_names:
            assert app in normalized_apps
