import pytest
from django.contrib.auth.models import Permission
from django.test import override_settings

from sentry.db.router import SiloRouter
from sentry.models.organization import Organization
from sentry.models.user import User
from sentry.testutils.cases import TestCase


class SiloRouterSimulatedTest(TestCase):
    """Simulated mode can resolve both silos to separate connections"""

    @override_settings(SILO_MODE=None)
    def test_simulated_no_silo(self):
        # Simulated silo mode should work the same as with a silo mode defined..
        router = SiloRouter()
        router.use_simulated(True)
        assert "default" == router.db_for_read(Organization)
        assert "default" == router.db_for_write(Organization)
        assert router.allow_migrate("default", "sentry", Organization)
        assert not router.allow_migrate("control", "sentry", Organization)

        assert "control" == router.db_for_write(Permission)
        assert "control" == router.db_for_read(User)
        assert "control" == router.db_for_write(User)
        assert router.allow_migrate("control", "sentry", User)
        assert not router.allow_migrate("default", "sentry", User)

        assert not router.allow_migrate("default", "django.contrib.auth", Permission)
        assert router.allow_migrate("control", "django.contrib.auth", Permission)
        assert not router.allow_migrate(
            "default", "sentry", model=None, tables=["jira_ac_tenant"]
        ), "Removed tables should not error and not route"

    @override_settings(SILO_MODE="CONTROL")
    def test_for_control(self):
        router = SiloRouter()
        router.use_simulated(True)
        assert "default" == router.db_for_read(Organization)
        assert "default" == router.db_for_write(Organization)
        assert router.allow_migrate("default", "sentry", Organization)
        assert not router.allow_migrate("control", "sentry", Organization)

        assert "control" == router.db_for_read(User)
        assert "control" == router.db_for_write(User)
        assert router.allow_migrate("control", "sentry", User)
        assert not router.allow_migrate("default", "sentry", User)

        assert not router.allow_migrate(
            "default", "sentry", model=None, tables=["jira_ac_tenant"]
        ), "Removed tables should not error and not route"

    @override_settings(SILO_MODE="REGION")
    def test_for_region(self):
        router = SiloRouter()
        router.use_simulated(True)
        assert "default" == router.db_for_read(Organization)
        assert "default" == router.db_for_write(Organization)
        assert router.allow_migrate("default", "sentry", Organization)
        assert not router.allow_migrate("control", "sentry", Organization)

        assert "control" == router.db_for_read(User)
        assert "control" == router.db_for_write(User)
        assert router.allow_migrate("control", "sentry", User)
        assert not router.allow_migrate("default", "sentry", User)

    @override_settings(SILO_MODE="MONOLITH")
    def test_for_monolith_simulated(self):
        router = SiloRouter()
        router.use_simulated(True)
        assert "default" == router.db_for_read(Organization)
        assert "control" == router.db_for_read(User)

        assert "default" == router.db_for_write(Organization)
        assert "control" == router.db_for_write(User)

        assert router.allow_migrate("default", "sentry", Organization)
        assert not router.allow_migrate("control", "sentry", Organization)
        assert router.allow_migrate("control", "sentry", User)
        assert not router.allow_migrate("default", "sentry", User)

    @override_settings(SILO_MODE="MONOLITH")
    def test_for_monolith(self):
        router = SiloRouter()
        assert "default" == router.db_for_read(Organization)
        assert "default" == router.db_for_read(User)
        assert "default" == router.db_for_write(Organization)
        assert "default" == router.db_for_write(User)
        assert router.allow_migrate("default", "sentry", Organization)
        assert router.allow_migrate("default", "sentry", User)


class SiloRouterIsolatedTest(TestCase):
    """Isolated mode raises errors for the 'other' silo"""

    @override_settings(SILO_MODE="CONTROL")
    def test_for_control(self):
        router = SiloRouter()
        router.use_simulated(False)

        assert "default" == router.db_for_read(User)
        assert "default" == router.db_for_write(User)
        assert router.allow_migrate("default", "sentry", User)
        assert not router.allow_migrate("control", "sentry", User)
        assert not router.allow_migrate(
            "default", "sentry", model=None, tables=["jira_ac_tenant"]
        ), "Removed tables end up excluded from migrations"

        with pytest.raises(ValueError):
            router.db_for_read(Organization)
        with pytest.raises(ValueError):
            router.db_for_write(Organization)
        with pytest.raises(ValueError):
            router.allow_migrate("default", "sentry", Organization)

    @override_settings(SILO_MODE="REGION")
    def test_for_region(self):
        router = SiloRouter()
        router.use_simulated(False)

        assert "default" == router.db_for_read(Organization)
        assert "default" == router.db_for_write(Organization)
        assert router.allow_migrate("default", "sentry", Organization)
        assert not router.allow_migrate("region", "sentry", Organization)
        assert not router.allow_migrate(
            "default", "sentry", model=None, tables=["jira_ac_tenant"]
        ), "Removed tables end up excluded from migrations"

        with pytest.raises(ValueError):
            router.db_for_read(User)
        with pytest.raises(ValueError):
            router.db_for_write(User)

        # Can't migrate region/control in isolated silos
        with pytest.raises(ValueError):
            router.allow_migrate("control", "sentry", User)

    @override_settings(SILO_MODE="MONOLITH")
    def test_for_monolith(self):
        router = SiloRouter()
        router.use_simulated(False)

        assert "default" == router.db_for_read(Organization)
        assert "default" == router.db_for_read(User)
        assert "default" == router.db_for_write(Organization)
        assert "default" == router.db_for_write(User)
        assert router.allow_migrate("default", "sentry", Organization)
        assert router.allow_migrate("default", "sentry", User)
