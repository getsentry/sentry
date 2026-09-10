from sentry.issues import grouptype
from sentry.workflow_engine.registry import (
    detector_handler_registry,
    detector_validator_registry,
)


def registered_slugs() -> set[str]:
    return set(detector_handler_registry.registrations) | set(
        detector_validator_registry.registrations
    )


def test_every_registration_resolves_to_a_group_type() -> None:
    for slug in registered_slugs():
        assert grouptype.registry.get_by_slug(slug) is not None, (
            f"{slug} is registered as a detector handler or validator but no GroupType has that slug"
        )


def test_no_group_type_assigns_detector_settings_directly() -> None:
    for group_type in grouptype.registry.all():
        assert "detector_settings" not in vars(group_type), (
            f"{group_type.slug} assigns detector_settings in its class body; "
            "register a handler and validator instead"
        )
