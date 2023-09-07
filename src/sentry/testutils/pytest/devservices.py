import pytest

from tools.devservices_healthcheck import check_health


@pytest.fixture(scope="session")
def common_devservices_healthcheck():
    check_health(["postgres", "redis"], retries=1)


@pytest.fixture(scope="session")
def symbolicator_healthcheck():
    check_health(["symbolicator", "kafka"], retries=1)


@pytest.fixture(scope="session")
def kafka_healthcheck():
    check_health(["kafka"], retries=1)
