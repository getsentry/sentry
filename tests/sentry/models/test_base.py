from django.test import override_settings
from pytest import raises

from sentry.db.models import ModelAvailableOn
from sentry.db.models.base import Model
from sentry.servermode import ServerComponentAvailabilityError, ServerComponentMode
from sentry.testutils import TestCase


class AvailableOnTest(TestCase):
    class TestModel(Model):
        __include_in_export__ = False

        class Meta:
            abstract = True
            app_label = "fixtures"

    @ModelAvailableOn(ServerComponentMode.CONTROL)
    class ControlModel(TestModel):
        pass

    @ModelAvailableOn(ServerComponentMode.CUSTOMER)
    class CustomerModel(TestModel):
        pass

    @ModelAvailableOn(ServerComponentMode.CONTROL, read_only=ServerComponentMode.CUSTOMER)
    class ReadOnlyModel(TestModel):
        pass

    class ModelOnMonolith(TestModel):
        pass

    def test_available_on_monolith_mode(self):
        assert list(self.ModelOnMonolith.objects.all()) == []
        with raises(self.ModelOnMonolith.DoesNotExist):
            self.ModelOnMonolith.objects.get(id=1)

        self.ModelOnMonolith.objects.create()
        assert self.ModelOnMonolith.objects.count() == 1

        self.ModelOnMonolith.objects.filter(id=1).delete()

    @override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.CUSTOMER)
    def test_available_on_same_mode(self):
        assert list(self.CustomerModel.objects.all()) == []
        with raises(self.CustomerModel.DoesNotExist):
            self.CustomerModel.objects.get(id=1)

        self.CustomerModel.objects.create()
        assert self.CustomerModel.objects.count() == 1

        self.CustomerModel.objects.filter(id=1).delete()

    @override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.CUSTOMER)
    def test_unavailable_on_other_mode(self):
        with raises(ServerComponentAvailabilityError):
            list(self.ControlModel.objects.all())
        with raises(ServerComponentAvailabilityError):
            self.ControlModel.objects.get(id=1)
        with raises(ServerComponentAvailabilityError):
            self.ControlModel.objects.create()
        with raises(ServerComponentAvailabilityError):
            self.ControlModel.objects.filter(id=1).delete()

    @override_settings(SERVER_COMPONENT_MODE=ServerComponentMode.CUSTOMER)
    def test_available_for_read_only(self):
        assert list(self.ReadOnlyModel.objects.all()) == []
        with raises(self.ReadOnlyModel.DoesNotExist):
            self.ReadOnlyModel.objects.get(id=1)

        with raises(ServerComponentAvailabilityError):
            self.ReadOnlyModel.objects.create()
        with raises(ServerComponentAvailabilityError):
            self.ReadOnlyModel.objects.filter(id=1).delete()
