from sentry.db.models.query import in_iexact
from sentry.models import Organization, Team, User
from sentry.testutils import TestCase
from sentry.utils.query import RangeQuerySetWrapper, bulk_delete_objects


class InIexactQueryTest(TestCase):
    def test_basic(self):
        self.create_organization(slug="SlugA")
        self.create_organization(slug="slugB")
        self.create_organization(slug="slugc")

        assert Organization.objects.filter(in_iexact("slug", ["sluga", "slugb"])).count() == 2
        assert Organization.objects.filter(in_iexact("slug", ["slugC"])).count() == 1
        assert Organization.objects.filter(in_iexact("slug", [])).count() == 0


class RangeQuerySetWrapperTest(TestCase):
    def test_basic(self):
        total = 10

        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        assert len(list(RangeQuerySetWrapper(qs, step=2))) == total
        assert len(list(RangeQuerySetWrapper(qs, limit=5))) == 5

    def test_loop_and_delete(self):
        total = 10
        for _ in range(total):
            self.create_user()

        qs = User.objects.all()

        for user in RangeQuerySetWrapper(qs, step=2):
            user.delete()

        assert User.objects.all().count() == 0


class BulkDeleteObjectsTest(TestCase):
    def setUp(self):
        super().setUp()
        Team.objects.all().delete()

    def test_basic(self):
        total = 10
        records = []
        for _ in range(total):
            records.append(self.create_team())

        result = bulk_delete_objects(Team, id__in=[r.id for r in records])
        assert result, "Could be more work to do"
        assert len(Team.objects.all()) == 0

    def test_limiting(self):
        total = 10
        records = []
        for _ in range(total):
            records.append(self.create_team())

        result = bulk_delete_objects(Team, id__in=[r.id for r in records], limit=5)
        assert result, "Still more work to do"
        assert len(Team.objects.all()) == 5
