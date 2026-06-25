import pytest
from django.db import IntegrityError

from sentry.models.weeklyreportprojectexclusion import WeeklyReportProjectExclusion
from sentry.testutils.cases import TestCase


class WeeklyReportProjectExclusionTest(TestCase):
    def test_create(self):
        exclusion = WeeklyReportProjectExclusion.objects.create(
            project=self.project,
            user_id=self.user.id,
        )
        assert exclusion.project_id == self.project.id
        assert exclusion.user_id == self.user.id
        assert exclusion.date_added is not None

    def test_unique_constraint(self):
        WeeklyReportProjectExclusion.objects.create(
            project=self.project,
            user_id=self.user.id,
        )
        with pytest.raises(IntegrityError):
            WeeklyReportProjectExclusion.objects.create(
                project=self.project,
                user_id=self.user.id,
            )

    def test_different_users_same_project(self):
        other_user = self.create_user()
        WeeklyReportProjectExclusion.objects.create(
            project=self.project,
            user_id=self.user.id,
        )
        exclusion2 = WeeklyReportProjectExclusion.objects.create(
            project=self.project,
            user_id=other_user.id,
        )
        assert exclusion2.user_id == other_user.id

    def test_same_user_different_projects(self):
        project2 = self.create_project(organization=self.organization)
        WeeklyReportProjectExclusion.objects.create(
            project=self.project,
            user_id=self.user.id,
        )
        exclusion2 = WeeklyReportProjectExclusion.objects.create(
            project=project2,
            user_id=self.user.id,
        )
        assert exclusion2.project_id == project2.id

    def test_cascade_on_project_delete(self):
        WeeklyReportProjectExclusion.objects.create(
            project=self.project,
            user_id=self.user.id,
        )
        assert WeeklyReportProjectExclusion.objects.filter(
            project=self.project, user_id=self.user.id
        ).exists()

        self.project.delete()

        assert not WeeklyReportProjectExclusion.objects.filter(user_id=self.user.id).exists()
