from django.test import override_settings

from sentry.db.models import available_on
from sentry.db.models.base import BaseModel, ServerModeDataError
from sentry.servermode import ServerComponentMode
from sentry.testutils import TestCase


class AvailableOnTest(TestCase):
    with override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.CUSTOMER):

        @available_on(ServerComponentMode.CONTROL)
        class ControlModel(BaseModel):
            __include_in_export__ = False

        @available_on(ServerComponentMode.CUSTOMER)
        class CustomerModel(BaseModel):
            __include_in_export__ = False

        @available_on(ServerComponentMode.CONTROL, read_only=ServerComponentMode.CUSTOMER)
        class ReadOnlyModel(BaseModel):
            __include_in_export__ = False

    with override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.MONOLITH):

        @available_on(ServerComponentMode.MONOLITH)
        class ModelOnMonolith(BaseModel):
            __include_in_export__ = False

    def test_available_on_monolith_mode(self):
        assert list(self.ModelOnMonolith.objects.all()) == []
        with self.assertRaises(self.ModelOnMonolith.DoesNotExist):
            self.ModelOnMonolith.objects.get(id=1)

        self.ModelOnMonolith.objects.create()
        assert self.ModelOnMonolith.objects.count() == 1

        self.ModelOnMonolith.objects.filter(id=1).delete()

    def test_available_on_same_mode(self):
        assert list(self.CustomerModel.objects.all()) == []
        with self.assertRaises(self.CustomerModel.DoesNotExist):
            self.CustomerModel.objects.get(id=1)

        self.CustomerModel.objects.create()
        assert self.CustomerModel.objects.count() == 1

        self.CustomerModel.objects.filter(id=1).delete()

    def test_unavailable_on_other_mode(self):
        with self.assertRaises(ServerModeDataError):
            list(self.ControlModel.objects.all())
        with self.assertRaises(ServerModeDataError):
            self.ControlModel.objects.get(id=1)
        with self.assertRaises(ServerModeDataError):
            self.ControlModel.objects.create()
        with self.assertRaises(ServerModeDataError):
            self.ControlModel.objects.filter(id=1).delete()

    def test_available_for_read_only(self):
        assert list(self.ReadOnlyModel.objects.all()) == []
        with self.assertRaises(self.ReadOnlyModel.DoesNotExist):
            self.ReadOnlyModel.objects.get(id=1)

        with self.assertRaises(ServerModeDataError):
            self.ReadOnlyModel.objects.create()
        with self.assertRaises(ServerModeDataError):
            self.ReadOnlyModel.objects.filter(id=1).delete()
