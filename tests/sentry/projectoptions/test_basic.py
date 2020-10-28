from __future__ import absolute_import

import pytest

from contextlib import contextmanager

from sentry.projectoptions import defaults, default_manager
from sentry.projectoptions.manager import WellKnownProjectOption
from sentry.models import ProjectOption


@contextmanager
def latest_epoch(value):
    old = defaults.LATEST_EPOCH
    try:
        defaults.LATEST_EPOCH = value
        yield
    finally:
        defaults.LATEST_EPOCH = old


@pytest.mark.django_db
def test_defaults(default_project):
    default_manager.register(
        key="__sentry_test:test-option",
        epoch_defaults={1: "whatever", 10: "new-value", 42: "latest-value"},
    )

    assert default_project.get_option("__sentry_test:test-option") == "whatever"

    with latest_epoch(42):
        default_manager.freeze_option_epoch(default_project, force=True)
        ProjectOption.objects.reload_cache(default_project.id, "")

    assert default_project.get_option("__sentry_test:test-option") == "latest-value"


@pytest.mark.django_db
def freeze_option(factories, default_team):
    with latest_epoch(42):
        project = factories.create_project(name="Bar", slug="bar", teams=[default_team])
        assert project.get_option("sentry:option-epoch", defaults.LATEST_EPOCH)


def test_epoch_defaults():
    option = WellKnownProjectOption(
        key="__sentry_test:test-option",
        epoch_defaults={1: "whatever", 10: "new-value", 42: "latest-value"},
        default="default",
    )

    assert option.get_default(epoch=0) == "default"
    assert option.get_default(epoch=1) == "whatever"
    assert option.get_default(epoch=10) == "new-value"
    assert option.get_default(epoch=20) == "new-value"
    assert option.get_default(epoch=42) == "latest-value"
    assert option.get_default(epoch=100) == "latest-value"
