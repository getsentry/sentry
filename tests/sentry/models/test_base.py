from unittest.mock import MagicMock

from django.test import override_settings
from pytest import raises

from sentry.backup.scopes import RelocationScope
from sentry.db.models.base import Model, ModelSiloLimit, get_model_if_available
from sentry.silo import SiloMode
from sentry.testutils.cases import TestCase


class AvailableOnTest(TestCase):
    class TestModel(Model):
        __relocation_scope__ = RelocationScope.Excluded

        class Meta:
            abstract = True
            app_label = "fixtures"

    @ModelSiloLimit(SiloMode.CONTROL)
    class ControlModel(TestModel):
        pass

    @ModelSiloLimit(SiloMode.REGION)
    class RegionModel(TestModel):
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

    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_available_on_same_mode(self):
        assert list(self.RegionModel.objects.all()) == []
        with raises(self.RegionModel.DoesNotExist):
            self.RegionModel.objects.get(id=1)

        self.RegionModel.objects.create()
        assert self.RegionModel.objects.count() == 1

        self.RegionModel.objects.filter(id=1).delete()

    @override_settings(SILO_MODE=SiloMode.REGION)
    def test_unavailable_on_other_mode(self):
        with raises(ModelSiloLimit.AvailabilityError):
            list(self.ControlModel.objects.all())
        with raises(ModelSiloLimit.AvailabilityError):
            self.ControlModel.objects.get(id=1)
        with raises(ModelSiloLimit.AvailabilityError):
            self.ControlModel.objects.create()
        with raises(ModelSiloLimit.AvailabilityError):
            self.ControlModel.objects.filter(id=1).delete()

    def test_get_model_if_available(self):
        test_models = {
            m.__name__: m
            for m in (
                self.ControlModel,
                self.RegionModel,
                self.ModelOnMonolith,
            )
        }
        app_config = MagicMock()
        app_config.get_model.side_effect = test_models.get

        with override_settings(SILO_MODE=SiloMode.REGION):
            assert get_model_if_available(app_config, "ControlModel") is None
            assert get_model_if_available(app_config, "RegionModel") is self.RegionModel
            assert get_model_if_available(app_config, "ModelOnMonolith") is self.ModelOnMonolith

    def test_get_model_with_nonexistent_name(self):
        app_config = MagicMock()
        app_config.get_model.side_effect = LookupError
        assert get_model_if_available(app_config, "BogusModel") is None
        app_config.get_model.assert_called_with("BogusModel")
