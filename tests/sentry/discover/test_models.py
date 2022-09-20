import pytest
from django.core.validators import ValidationError

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.models import User
from sentry.testutils import TestCase


class DiscoverSavedQueryTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
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

    def test_only_single_default_query_for_user(self):
        user = User.objects.create(email="test@sentry.io")
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            version=2,
            created_by=user,
            is_default=True,
        )

        with pytest.raises(ValidationError):
            DiscoverSavedQuery.objects.create(
                organization=self.org,
                name="Test query 2",
                query=self.query,
                version=2,
                created_by=user,
                is_default=True,
            )
