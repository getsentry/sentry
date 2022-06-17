from django.test import override_settings
from pytest import raises

from sentry.db.models import Model, available_on
from sentry.db.models.base import ServerModeDataError
from sentry.servermode import ServerComponentMode
from sentry.testutils import TestCase


class AvailableOnTest(TestCase):
    with override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.CUSTOMER):

        @available_on(ServerComponentMode.CONTROL)
        class ControlModel(Model):
            __include_in_export__ = False

        @available_on(ServerComponentMode.CUSTOMER)
        class CustomerModel(Model):
            __include_in_export__ = False

    with override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.MONOLITH):

        @available_on(ServerComponentMode.MONOLITH)
        class ModelOnMonolith(Model):
            __include_in_export__ = False

    def test_available_on_monolith_mode(self):
        assert list(self.ModelOnMonolith.objects.all()) == []
        with raises(self.ModelOnMonolith.DoesNotExist):
            self.ModelOnMonolith.objects.get(id=1)

        self.ModelOnMonolith.objects.create()
        assert self.ModelOnMonolith.objects.count() == 1

    def test_available_on_same_mode(self):
        assert list(self.CustomerModel.objects.all()) == []
        with raises(self.CustomerModel.DoesNotExist):
            self.CustomerModel.objects.get(id=1)

        self.CustomerModel.objects.create()
        assert self.CustomerModel.objects.count() == 1

    def test_unavailable_on_other_mode(self):
        with raises(ServerModeDataError):
            list(self.ControlModel.objects.all())
        with raises(ServerModeDataError):
            self.ControlModel.objects.get(id=1)
        with raises(ServerModeDataError):
            self.ControlModel.objects.create()
