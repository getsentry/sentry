import pytest
from rest_framework.response import Response

from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import assume_test_silo_mode
from sentry.web.frontend.base import BaseView, ViewSiloLimit


class ViewSiloLimitTest(APITestCase):
    def _test_active_on(self, endpoint_mode, active_mode, expect_to_be_active):
        @ViewSiloLimit([endpoint_mode])
        def view_func(request):
            pass

        @ViewSiloLimit([endpoint_mode])
        class DummyView(BaseView):
            def get(self, request):
                return Response("dummy-view", 200)

        view_class_func = DummyView.as_view()
        with assume_test_silo_mode(active_mode):
            request = self.make_request(method="GET", path="/dummy/")
            setattr(request, "subdomain", "acme")

            if expect_to_be_active:
                view_func(request)
                view_class_func(request)
            else:
                with pytest.raises(ViewSiloLimit.AvailabilityError):
                    view_func(request)
                with pytest.raises(ViewSiloLimit.AvailabilityError):
                    view_class_func(request)

    def test_with_active_mode(self) -> None:
        self._test_active_on(SiloMode.REGION, SiloMode.REGION, True)
        self._test_active_on(SiloMode.CONTROL, SiloMode.CONTROL, True)

    def test_with_inactive_mode(self) -> None:
        self._test_active_on(SiloMode.REGION, SiloMode.CONTROL, False)
        self._test_active_on(SiloMode.CONTROL, SiloMode.REGION, False)

    def test_with_monolith_mode(self) -> None:
        self._test_active_on(SiloMode.REGION, SiloMode.MONOLITH, True)
        self._test_active_on(SiloMode.CONTROL, SiloMode.MONOLITH, True)

    def test_sets_silo_limit_on_function(self) -> None:
        @ViewSiloLimit([SiloMode.CONTROL])
        def view_func(request):
            pass

        assert view_func.silo_limit, "Should have silo_limit set"
        assert view_func.silo_limit.modes, "Should have silo_limit.modes set"
        assert not view_func.silo_limit.internal, "Not internal by default"

    def test_internal_attribute(self) -> None:
        @ViewSiloLimit([SiloMode.REGION], internal=True)
        def view_func(request):
            pass

        assert view_func.silo_limit, "Should have silo_limit set"
        assert view_func.silo_limit.modes, "Should have silo_limit.modes set"
        assert len(view_func.silo_limit.modes) == 1
        assert SiloMode.REGION in view_func.silo_limit.modes
        assert view_func.silo_limit.internal, "Should be marked as internal"
