import pytest
from django.db import IntegrityError, router, transaction

from sentry.discover.models import DiscoverSavedQuery, DiscoverSavedQueryProject
from sentry.testutils.cases import TestCase
from sentry.testutils.silo import assume_test_silo_mode_of
from sentry.users.models.user import User


class DiscoverSavedQueryTest(TestCase):
    def setUp(self):
        super().setUp()
        self.org = self.create_organization()
        with assume_test_silo_mode_of(User):
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

    def test_can_only_create_single_homepage_query_for_user(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by_id=self.user.id,
            is_homepage=True,
        )

        with pytest.raises(IntegrityError):
            DiscoverSavedQuery.objects.create(
                organization=self.org,
                name="Test query 2",
                query=self.query,
                created_by_id=self.user.id,
                is_homepage=True,
            )

    def test_can_only_have_single_homepage_query_for_user_on_update(self):
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by_id=self.user.id,
            is_homepage=True,
        )
        new_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query 2",
            query=self.query,
            created_by_id=self.user.id,
        )

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(DiscoverSavedQueryProject)),
        ):
            new_query.update(is_homepage=True)

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(DiscoverSavedQueryProject)),
        ):
            new_query.is_homepage = True
            new_query.save()

        with (
            pytest.raises(IntegrityError),
            transaction.atomic(router.db_for_write(DiscoverSavedQueryProject)),
        ):
            DiscoverSavedQuery.objects.filter(id=new_query.id).update(is_homepage=True)

    def test_user_can_have_homepage_query_in_multiple_orgs(self):
        other_org = self.create_organization()
        DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by_id=self.user.id,
            is_homepage=True,
        )
        new_query = DiscoverSavedQuery.objects.create(
            organization=other_org,
            name="Test query 2",
            query=self.query,
            created_by_id=self.user.id,
        )

        # Does not error since the query is in another org
        new_query.update(is_homepage=True)

    def test_delete_project_cascade(self):
        project = self.create_project()
        remaining_project = self.create_project()

        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by_id=self.user.id,
            is_homepage=True,
        )
        remaining_saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query 2",
            query=self.query,
            created_by_id=self.user.id,
        )

        saved_query.projects.set([project])
        remaining_saved_query.projects.set([project, remaining_project])

        assert DiscoverSavedQueryProject.objects.filter(
            discover_saved_query=saved_query, project=project
        ).exists()

        # Delete the project to trigger the cascade
        deleted_project_id = project.id
        project.delete()

        # No entries for the saved query project relationship with just the deleted project
        assert not DiscoverSavedQueryProject.objects.filter(
            discover_saved_query=saved_query, project_id=deleted_project_id
        ).exists()
        # Other saved query still has entries for the remaining project
        assert DiscoverSavedQueryProject.objects.filter(
            discover_saved_query=remaining_saved_query, project=remaining_project
        ).exists()

    def test_delete_dashboard_cascade(self):
        project = self.create_project()

        saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query",
            query=self.query,
            created_by_id=self.user.id,
            is_homepage=True,
        )
        remaining_saved_query = DiscoverSavedQuery.objects.create(
            organization=self.org,
            name="Test query 2",
            query=self.query,
            created_by_id=self.user.id,
        )

        saved_query.projects.set([project])
        remaining_saved_query.projects.set([project])

        assert DiscoverSavedQueryProject.objects.filter(
            discover_saved_query=saved_query, project=project
        ).exists()

        # Delete the saved query to trigger the cascade
        deleted_saved_query_id = saved_query.id
        saved_query.delete()

        # The deleted saved query cascaded and deletes the saved query-project relationship
        assert not DiscoverSavedQueryProject.objects.filter(
            project=project, discover_saved_query_id=deleted_saved_query_id
        ).exists()

        # The remaining saved query still has a relationship entry
        assert DiscoverSavedQueryProject.objects.filter(
            project=project, discover_saved_query=remaining_saved_query
        ).exists()
