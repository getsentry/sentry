import pytest
from django.db.utils import IntegrityError

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.models import User
from sentry.testutils import TestCase


class DiscoverSavedQueryTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        self.user = User.objects.create(email="test@sentry.io")
        self.project_ids = [
            self.create_project(organization=self.org).id,
            self.create_project(organization=self.org).id,
        ]
        self.query = {"fields": ["test"], "conditions": [], "limit": 10}

    def test_create(self):
        model = DiscoverSavedQuery.objects.create(
            organization=self.org, name="Test query", query=self.query
        )

        model.set_projects(self.project_ids)

        assert DiscoverSavedQuery.objects.get(id=model.id).query == self.query
        assert (
            sorted(DiscoverSavedQueryProject.objects.all().values_list("project_id", flat=True))
            == self.project_ids
        )

    def test_update_projects(self):
        model = DiscoverSavedQuery.objects.create(
            organization=self.org, name="Test query", query=self.query
        )

        model.set_projects(self.project_ids)

        model.set_projects([])

        assert (
            sorted(DiscoverSavedQueryProject.objects.all().values_list("project_id", flat=True))
            == []
        )

        model.set_projects([self.project_ids[0]])
        assert sorted(
            DiscoverSavedQueryProject.objects.all().values_list("project_id", flat=True)
        ) == [self.project_ids[0]]

    def test_can_only_create_single_default_query_for_user(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by=self.user,
            is_default=True,
        )

        with pytest.raises(IntegrityError):
            DiscoverSavedQuery.objects.create(
                organization=self.org,
                name="Test query 2",
                query=self.query,
                created_by=self.user,
                is_default=True,
            )

    def test_can_only_have_single_default_query_for_user_on_update(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by=self.user,
            is_default=True,
        )
        new_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query 2",
            query=self.query,
            created_by=self.user,
        )

        with pytest.raises(IntegrityError):
            new_query.update(is_default=True)

    def test_can_only_have_single_default_query_for_user_on_update_query_set(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by=self.user,
            is_default=True,
        )
        new_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query 2",
            query=self.query,
            created_by=self.user,
        )

        with pytest.raises(IntegrityError):
            DiscoverSavedQuery.objects.filter(id=new_query.id).update(is_default=True)

    def test_only_have_single_default_query_for_user_on_direct_update(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by=self.user,
            is_default=True,
        )
        new_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query 2",
            query=self.query,
            created_by=self.user,
        )

        with pytest.raises(IntegrityError):
            new_query.is_default = True
            new_query.save()
