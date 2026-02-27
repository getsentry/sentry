from unittest.mock import MagicMock, patch

from django.conf import settings

from sentry.seer.services.test_generation.service import test_generation_service
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import control_silo_test


@patch("sentry.seer.services.test_generation.impl.make_signed_seer_api_request")
@django_db_all
@control_silo_test
def test_start_unit_test_generation(mock_request: MagicMock) -> None:
    mock_request.return_value.status = 200
    mock_request.return_value.json.return_value = {}
    response = test_generation_service.start_unit_test_generation(
        region_name=settings.SENTRY_MONOLITH_REGION,
        github_org="some-org",
        repo="some-repo",
        pr_id=1,
        external_id="some-external_id",
    )
    assert response.success

    mock_request.assert_called_once()
