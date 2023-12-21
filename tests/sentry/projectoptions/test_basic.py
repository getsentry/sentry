from unittest import mock

from sentry.models.options.project_option import ProjectOption
from sentry.projectoptions import default_manager, defaults
from sentry.projectoptions.manager import WellKnownProjectOption
from sentry.testutils.pytest.fixtures import django_db_all


def latest_epoch(value):
    return mock.patch.object(defaults, "LATEST_EPOCH", value)


@django_db_all
@latest_epoch(10)
def test_defaults(default_project):
    default_manager.register(
        key="__sentry_test:test-option",
        epoch_defaults={1: "whatever", 20: "new-value", 42: "latest-value"},
    )

    assert default_project.get_option("__sentry_test:test-option") == "whatever"

    with latest_epoch(42):
        default_manager.freeze_option_epoch(default_project, force=True)
        ProjectOption.objects.reload_cache(default_project.id, "")

    assert default_project.get_option("__sentry_test:test-option") == "latest-value"


@django_db_all
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


@django_db_all
def test_isset_simple(default_project):
    default_manager.register("best_dogs", default="all dogs")

    assert default_project.get_option("best_dogs") == "all dogs"
    assert default_manager.isset(default_project, "best_dogs") is False

    default_project.update_option("best_dogs", "Maisey and Charlie")
    assert default_project.get_option("best_dogs") == "Maisey and Charlie"
    assert default_manager.isset(default_project, "best_dogs") is True


@django_db_all
def test_isset_differentiates_unset_from_set_to_default(default_project):
    default_manager.register("best_dogs", default="all dogs")

    assert default_project.get_option("best_dogs") == "all dogs"
    assert default_manager.isset(default_project, "best_dogs") is False

    default_project.update_option("best_dogs", "all dogs")
    assert default_project.get_option("best_dogs") == "all dogs"
    assert default_manager.isset(default_project, "best_dogs") is True
