from unittest.mock import Mock, patch

import requests
from django.conf import settings

from sentry.seer.services.test_generation.service import test_generation_service
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test


@patch("sentry.seer.services.test_generation.impl.requests.post")
@django_db_all
@control_silo_test
def test_start_unit_test_generation(posts_mock):
    response_object: requests.Response = requests.Response()
    response_object.json = Mock(method="json", return_value={})  # type: ignore[method-assign]
    response_object.status_code = 200
    posts_mock.return_value = response_object
    response = test_generation_service.start_unit_test_generation(
        region_name=settings.SENTRY_MONOLITH_REGION,
        github_org="some-org",
        repo="some-repo",
        pr_id=1,
        external_id="some-external_id",
    )
    assert response.success

    posts_mock.assert_called_once()
