import django.apps
import django.urls
from django.views.generic import RedirectView, TemplateView, View

from sentry.api.base import Endpoint
from sentry.testutils.cases import TestCase


class SiloLimitCoverageTest(TestCase):
    """Check that all subclasses have expected SiloLimit decorators."""

    def test_all_models_have_silo_limit_decorator(self) -> None:
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

    def test_all_endpoints_have_silo_mode_decorator(self) -> None:
        undecorated_endpoint_classes = []
        undecorated_view_classes = []
        undecorated_view_functions = []

        url_mappings = django.urls.get_resolver().reverse_dict.items()
        for view_function, bindings in url_mappings:
            view_class = getattr(view_function, "view_class", None)
            if (
                view_class
                and issubclass(view_class, Endpoint)
                and not hasattr(view_class, "silo_limit")
            ):
                undecorated_endpoint_classes.append(view_class)
            elif (
                view_class
                and issubclass(view_class, View)
                and view_class != RedirectView
                and view_class != TemplateView
                and not hasattr(view_class, "silo_limit")
            ):
                undecorated_view_classes.append(view_class)
            elif (
                view_class is None
                and callable(view_function)
                and not hasattr(view_function, "silo_limit")
                # Django's internal media views/static
                and "django.views.static" not in view_function.__module__
            ):
                undecorated_view_functions.append(view_function)

        assert len(undecorated_endpoint_classes) == 0, (
            "Endpoint classes missing EndpointSiloLimit: "
            f"{', '.join(f"{m.__module__}.{m.__name__}" for m in undecorated_endpoint_classes)}"
        )
        assert len(undecorated_view_classes) == 0, (
            "View classes missing ViewSiloLimit: "
            f"{', '.join(f"{m.__module__}.{m.__name__}" for m in undecorated_view_classes)}"
        )
        assert len(undecorated_view_functions) == 0, (
            "View functions missing ViewSiloLimit: "
            f"{', '.join(f"{m.__module__}.{m}" for m in undecorated_view_functions)}"
        )
