import django.apps
import django.urls

from sentry.api.base import Endpoint
from sentry.testutils.cases import TestCase


class SiloLimitCoverageTest(TestCase):
    """Check that all subclasses have expected SiloLimit decorators."""

    def test_all_models_have_silo_limit_decorator(self):
        undecorated_model_classes = []

        for model_class in django.apps.apps.get_models():
            if model_class._meta.app_label == "sentry" and not hasattr(
                model_class._meta, "silo_limit"
            ):
                undecorated_model_classes.append(model_class)

        assert len(undecorated_model_classes) == 0, (
            "Model classes missing ModelSiloLimit: "
            f"{', '.join(m.__name__ for m in undecorated_model_classes)}"
        )

    def test_all_endpoints_have_silo_mode_decorator(self):
        undecorated_endpoint_classes = []

        url_mappings = django.urls.get_resolver().reverse_dict.items()
        for (view_function, bindings) in url_mappings:
            view_class = getattr(view_function, "view_class", None)
            if (
                view_class
                and issubclass(view_class, Endpoint)
                and not hasattr(view_class, "silo_limit")
            ):
                undecorated_endpoint_classes.append(view_class)

        assert len(undecorated_endpoint_classes) == 0, (
            "Endpoint classes missing EndpointSiloLimit: "
            f"{', '.join(m.__name__ for m in undecorated_endpoint_classes)}"
        )
