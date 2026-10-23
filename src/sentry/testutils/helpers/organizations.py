from collections.abc import Iterator
from contextlib import contextmanager
from unittest.mock import patch


@contextmanager
def assert_no_organization_resource_hydration() -> Iterator[None]:
    with (
        patch(
            "sentry.organizations.services.organization.serial.serialize_project",
            side_effect=AssertionError("Unexpected project hydration"),
        ) as projects,
        patch(
            "sentry.organizations.services.organization.serial.serialize_rpc_team",
            side_effect=AssertionError("Unexpected team hydration"),
        ) as teams,
    ):
        yield
    # Catch hydration even when the caller handles the exception.
    projects.assert_not_called()
    teams.assert_not_called()
