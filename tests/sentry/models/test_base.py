from django.test import override_settings
from pytest import raises

from sentry.db.models.base import Model, ModelSiloLimit
from sentry.silo import SiloMode
from sentry.testutils import TestCase


class AvailableOnTest(TestCase):
    class TestModel(Model):
        __include_in_export__ = False

        class Meta:
            abstract = True
            app_label = "fixtures"

    @ModelSiloLimit(SiloMode.CONTROL)
    class ControlModel(TestModel):
        pass

    @ModelSiloLimit(SiloMode.CUSTOMER)
    class CustomerModel(TestModel):
        pass

    @ModelSiloLimit(SiloMode.CONTROL, read_only=SiloMode.CUSTOMER)
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

    @override_settings(SILO_MODE=SiloMode.CUSTOMER)
    def test_available_on_same_mode(self):
        assert list(self.CustomerModel.objects.all()) == []
        with raises(self.CustomerModel.DoesNotExist):
            self.CustomerModel.objects.get(id=1)

        self.CustomerModel.objects.create()
        assert self.CustomerModel.objects.count() == 1

        self.CustomerModel.objects.filter(id=1).delete()

    @override_settings(SILO_MODE=SiloMode.CUSTOMER)
    def test_unavailable_on_other_mode(self):
        with raises(ModelSiloLimit.AvailabilityError):
            list(self.ControlModel.objects.all())
        with raises(ModelSiloLimit.AvailabilityError):
            self.ControlModel.objects.get(id=1)
        with raises(ModelSiloLimit.AvailabilityError):
            self.ControlModel.objects.create()
        with raises(ModelSiloLimit.AvailabilityError):
            self.ControlModel.objects.filter(id=1).delete()

    @override_settings(SILO_MODE=SiloMode.CUSTOMER)
    def test_available_for_read_only(self):
        assert list(self.ReadOnlyModel.objects.all()) == []
        with raises(self.ReadOnlyModel.DoesNotExist):
            self.ReadOnlyModel.objects.get(id=1)

        with raises(ModelSiloLimit.AvailabilityError):
            self.ReadOnlyModel.objects.create()
        with raises(ModelSiloLimit.AvailabilityError):
            self.ReadOnlyModel.objects.filter(id=1).delete()
