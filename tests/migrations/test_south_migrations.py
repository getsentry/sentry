from __future__ import print_function, absolute_import

import pytest
from django.conf import settings

from .helpers import check_missing_migrations


@pytest.mark.skipif(not settings.SOUTH_TESTS_MIGRATE,
                    reason="requires activated south migrations")
def test_south_missing_migrations_in_sentry():
    assert check_missing_migrations(app='sentry')
