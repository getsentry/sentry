from sentry.notifications.platform.api.endpoints.internal_registered_templates import (
    serialize_template,
)
from sentry.notifications.platform.registry import template_registry
from sentry.testutils.cases import APITestCase
from sentry.testutils.silo import control_silo_test


@control_silo_test
class InternalRegisteredTemplatesEndpointTest(APITestCase):
    endpoint = "internal-notifications-registered-templates"

    def test_unauthenticated(self) -> None:
        response = self.get_response()
        assert response.status_code == 401

    def test_get_registered_templates(self) -> None:
        self.login_as(self.user)
        response = self.get_response()
        assert response.status_code == 200
        for source, template_cls in template_registry.registrations.items():
            template = template_cls()
            assert template.category.value in response.data
            assert (
                serialize_template(template=template, source=source)
                in response.data[template.category.value]
            )
