from sentry.models.commit import Commit
from sentry.models.release import Release
from sentry.models.releases.release_project import ReleaseProject
from sentry.plugins.interfaces.releasehook import ReleaseHook
from sentry.testutils.cases import TestCase


class FinishReleaseTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = "bbee5b51f84611e4b14834363b8514c2"

        hook = ReleaseHook(project)
        hook.finish_release(version)

        release = Release.objects.get(organization_id=project.organization_id, version=version)
        assert release.date_released
        assert release.organization
        assert ReleaseProject.objects.get(release=release, project=project)


class SetCommitsTest(TestCase):
    def test_minimal(self):
        project = self.create_project()
        version = "bbee5b51f84611e4b14834363b8514c2"
        data_list = [
            {
                "id": "c7155651831549cf8a5e47889fce17eb",
                "message": "foo",
                "author_email": "jane@example.com",
            },
            {"id": "bbee5b51f84611e4b14834363b8514c2", "message": "bar", "author_name": "Joe^^"},
        ]

        hook = ReleaseHook(project)
        hook.set_commits(version, data_list)

        release = Release.objects.get(projects=project, version=version)
        commit_list = list(
            Commit.objects.filter(releasecommit__release=release)
            .select_related("author")
            .order_by("releasecommit__order")
        )

        assert len(commit_list) == 2
        assert commit_list[0].key == "c7155651831549cf8a5e47889fce17eb"
        assert commit_list[0].message == "foo"
        assert commit_list[0].author is not None
        assert commit_list[0].author.name is None
        assert commit_list[0].author.email == "jane@example.com"
        assert commit_list[1].key == "bbee5b51f84611e4b14834363b8514c2"
        assert commit_list[1].message == "bar"
        assert commit_list[1].author is not None
        assert commit_list[1].author.name == "Joe^^"
        assert commit_list[1].author.email == "joe@localhost"
