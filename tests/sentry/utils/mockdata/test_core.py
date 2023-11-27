from sentry.models.broadcast import Broadcast
from sentry.models.environment import Environment
from sentry.models.project import Project
from sentry.models.release import Release
from sentry.models.team import Team
from sentry.models.user import User
from sentry.monitors.models import Monitor
from sentry.silo.base import SiloMode
from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.silo import assume_test_silo_mode, control_silo_test, region_silo_test
from sentry.utils import mockdata


@control_silo_test
@django_db_all
def test_create_user() -> None:
    user = mockdata.create_user()
    assert user.id


@control_silo_test
@django_db_all
def test_create_broadcast() -> None:
    mockdata.create_broadcast()
    cast = Broadcast.objects.filter().first()
    assert cast
    assert "Source Maps" in cast.title


@region_silo_test
@django_db_all
def test_get_organization() -> None:
    org = mockdata.get_organization()
    assert org
    assert "default" == org.slug


@region_silo_test
@django_db_all
def test_create_member() -> None:
    with assume_test_silo_mode(SiloMode.CONTROL):
        user = mockdata.create_user()
    org = mockdata.get_organization()
    member = mockdata.create_member(org, user, "member")
    assert member
    assert "member" == member.role


class TestMockData(SnubaTestCase, TestCase):
    def test_main_skip_default_setup(self) -> None:
        self.create_user(is_superuser=True)

        mockdata.main(skip_default_setup=True, num_events=0)

        user = User.objects.get(is_superuser=False)
        assert user, "Should make a regular user"

        assert Project.objects.count() == 6, "Should make some projects"
        assert Team.objects.count() == 2, "Should make some teams"
        assert Environment.objects.count() == 2, "Should make an environment"
        assert Release.objects.count() == 0, "No release as skip_default_setup was true"
        assert Monitor.objects.count() == 0, "No monitor as skip_default_setup was true"

    def test_main_default_setup(self) -> None:
        self.create_user(is_superuser=True)
        mockdata.main(skip_default_setup=False)

        user = User.objects.get(is_superuser=False)
        assert user, "Should make a regular user"

        assert Project.objects.count() == 6, "Should make some projects"
        assert Team.objects.count() == 2, "Should make some teams"
        assert Environment.objects.count() == 6, "Should environments"
        assert Release.objects.count() == 7, "Should create a release"
        assert Monitor.objects.count() == 6, "Should create a monitor"
