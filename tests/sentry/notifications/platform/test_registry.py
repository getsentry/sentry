import subprocess
import sys

from sentry.notifications.platform.discord.provider import DiscordNotificationProvider
from sentry.notifications.platform.email.provider import EmailNotificationProvider
from sentry.notifications.platform.msteams.provider import MSTeamsNotificationProvider
from sentry.notifications.platform.registry import provider_registry, template_registry
from sentry.notifications.platform.slack.provider import (
    SlackNotificationProvider,
    SlackStagingNotificationProvider,
)
from sentry.testutils.cases import TestCase
from sentry.utils import json

SUBPROCESS_TEMPLATE_REGISTRATIONS = """
import importlib
import json
import pkgutil

from sentry.runner import configure

configure(skip_service_validation=True)

from sentry.notifications.platform import templates
from sentry.notifications.platform.registry import template_registry

on_startup = sorted(template_registry.registrations)
for module in pkgutil.walk_packages(templates.__path__, f"{templates.__name__}."):
    importlib.import_module(module.name)

print(json.dumps({"on_startup": on_startup, "all": sorted(template_registry.registrations)}))
"""


class NotificationProviderRegistryTest(TestCase):
    def test_get_all(self) -> None:
        providers = provider_registry.get_all()
        expected_providers = [
            EmailNotificationProvider,
            SlackNotificationProvider,
            SlackStagingNotificationProvider,
            MSTeamsNotificationProvider,
            DiscordNotificationProvider,
        ]

        assert len(providers) == len(expected_providers)
        for provider in expected_providers:
            assert provider in providers

    def test_get_available(self) -> None:
        providers = provider_registry.get_available()
        expected_providers = [EmailNotificationProvider]

        assert len(providers) == len(expected_providers)
        for provider in expected_providers:
            assert provider in providers


class NotificationTemplateRegistryTest(TestCase):
    def test_template_categories(self) -> None:
        for template in template_registry.registrations.values():
            assert template.category, (
                f"Template {template!r} was registered without a category!\n"
                "Use NotificationCategory within the class to fix this test"
            )

    def test_template_source_matches_categories(self) -> None:
        for source, template in template_registry.registrations.items():
            assert source in template.category.get_sources(), (
                f"Template {template!r} was registered with an unknown source ({source})\n"
                f"Add the '{source}' to NOTIFICATION_SOURCE_MAP on '{template.category.value}' to fix this test."
            )


def test_all_templates_registered_on_startup() -> None:
    """
    Notifications can be rendered in a different process than the one that sent them (e.g.
    notify_target_async runs in a taskworker), so every template must be registered when the app
    starts, not only once something happens to import its module. This runs in a fresh process
    since the test process has imported far more modules than a worker would on startup.
    """
    output = subprocess.check_output(
        [sys.executable, "-c", SUBPROCESS_TEMPLATE_REGISTRATIONS], text=True
    )
    registrations = json.loads(output.splitlines()[-1])

    missing = sorted(set(registrations["all"]) - set(registrations["on_startup"]))
    assert not missing, (
        f"Templates for {missing} are not registered on startup.\n"
        "Import their modules in sentry/notifications/platform/templates/__init__.py to fix this test."
    )
