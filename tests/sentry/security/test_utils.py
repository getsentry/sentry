from typing import int
from unittest.mock import MagicMock, patch

from sentry.security.utils import capture_security_app_activity
from sentry.sentry_apps.logic import SentryAppCreator
from sentry.sentry_apps.services.app import app_service
from sentry.silo.base import SiloMode
from sentry.testutils.factories import Factories
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import all_silo_test, assume_test_silo_mode


@all_silo_test
@django_db_all
@patch("sentry.security.utils.logger")
def test_logs_app_activity(
    mock_logger: MagicMock,
) -> None:
    # Create a user. This has to be done not in the control mode.
    with assume_test_silo_mode(SiloMode.CONTROL):
        user = Factories.create_user(email="test@example.com")

    # Create an organization. This has to be done not in the control mode.
    # Turn the organization into an RPC organization.
    with assume_test_silo_mode(SiloMode.REGION):
        organization = Factories.create_organization(owner=user)

    # Create a Sentry App using the creator. This needs to be run in control mode.
    with assume_test_silo_mode(SiloMode.CONTROL):
        creator = SentryAppCreator(
            name="Test Security App",
            author="Sentry",
            organization_id=organization.id,
            scopes=["project:read", "project:write"],
            webhook_url="http://example.com/webhook",
            is_internal=False,
        )
        sentry_app_orm = creator.run(user=user)

    # Get RPC version for cross-silo compatibility
    sentry_app = app_service.get_sentry_app_by_slug(slug=sentry_app_orm.slug)
    assert sentry_app is not None

    ip_address = "127.0.0.1"

    capture_security_app_activity(
        organization=organization,
        sentry_app=sentry_app,
        activity_type="app-installed",
        ip_address=ip_address,
    )

    mock_logger.info.assert_called_once()
    call_args = mock_logger.info.call_args

    assert call_args[0][0] == "audit.sentry_app.%s"
    assert call_args[0][1] == "app-installed"

    extra = call_args[1]["extra"]
    assert extra["ip_address"] == ip_address
    assert extra["organization_id"] == organization.id
    assert extra["sentry_app_id"] == sentry_app.id


@all_silo_test
@django_db_all
@patch("sentry.security.utils.logger")
def test_logs_with_installation_context(mock_logger: MagicMock) -> None:
    """Test that installation_id is included in logs when present in context."""
    with assume_test_silo_mode(SiloMode.CONTROL):
        user = Factories.create_user(email="test@example.com")

    with assume_test_silo_mode(SiloMode.REGION):
        organization = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.CONTROL):
        creator = SentryAppCreator(
            name="Test Security App",
            author="Sentry",
            organization_id=organization.id,
            scopes=["project:read", "project:write"],
            webhook_url="http://example.com/webhook",
            is_internal=False,
        )
        sentry_app_orm = creator.run(user=user)

    sentry_app = app_service.get_sentry_app_by_slug(slug=sentry_app_orm.slug)
    assert sentry_app is not None

    ip_address = "192.168.1.1"
    installation_id = 12345

    capture_security_app_activity(
        organization=organization,
        sentry_app=sentry_app,
        activity_type="app-token-created",
        ip_address=ip_address,
        context={"installation_id": installation_id},
    )

    mock_logger.info.assert_called_once()
    extra = mock_logger.info.call_args[1]["extra"]

    assert extra["installation_id"] == installation_id


@all_silo_test
@django_db_all
@patch("sentry.security.utils.logger")
def test_handles_different_activity_types(mock_logger: MagicMock) -> None:
    """Test that various activity types are logged."""
    with assume_test_silo_mode(SiloMode.CONTROL):
        user = Factories.create_user(email="test@example.com")

    with assume_test_silo_mode(SiloMode.REGION):
        organization = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.CONTROL):
        creator = SentryAppCreator(
            name="Test Security App",
            author="Sentry",
            organization_id=organization.id,
            scopes=["project:read", "project:write"],
            webhook_url="http://example.com/webhook",
            is_internal=False,
        )
        sentry_app_orm = creator.run(user=user)

    sentry_app = app_service.get_sentry_app_by_slug(slug=sentry_app_orm.slug)
    assert sentry_app is not None

    activity_types = [
        "app-installed",
        "app-uninstalled",
        "app-token-created",
        "app-permission-changed",
        "app-updated",
    ]

    for activity_type in activity_types:
        mock_logger.reset_mock()

        capture_security_app_activity(
            organization=organization,
            sentry_app=sentry_app,
            activity_type=activity_type,
            ip_address="127.0.0.1",
        )

        mock_logger.info.assert_called_once()
        call_args = mock_logger.info.call_args
        assert call_args[0][1] == activity_type


@all_silo_test
@django_db_all
@patch("sentry.security.utils.logger")
def test_context_with_multiple_fields(mock_logger: MagicMock) -> None:
    """Test that context with multiple fields is handled correctly."""
    with assume_test_silo_mode(SiloMode.CONTROL):
        user = Factories.create_user(email="test@example.com")

    with assume_test_silo_mode(SiloMode.REGION):
        organization = Factories.create_organization(owner=user)

    with assume_test_silo_mode(SiloMode.CONTROL):
        creator = SentryAppCreator(
            name="Test Security App",
            author="Sentry",
            organization_id=organization.id,
            scopes=["project:read", "project:write"],
            webhook_url="http://example.com/webhook",
            is_internal=False,
        )
        sentry_app_orm = creator.run(user=user)

    sentry_app = app_service.get_sentry_app_by_slug(slug=sentry_app_orm.slug)
    assert sentry_app is not None

    ip_address = "192.168.100.1"
    context = {
        "installation_id": 99999,
        "additional_field": "some_value",
        "another_field": 123,
    }

    capture_security_app_activity(
        organization=organization,
        sentry_app=sentry_app,
        activity_type="app-configured",
        ip_address=ip_address,
        context=context,
    )

    mock_logger.info.assert_called_once()
    extra = mock_logger.info.call_args[1]["extra"]

    # Only installation_id should be extracted to logger_context
    assert extra["installation_id"] == 99999
    # Other context fields should not be in logger_context
    assert "additional_field" not in extra
    assert "another_field" not in extra
