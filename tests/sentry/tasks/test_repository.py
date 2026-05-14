from sentry.constants import ObjectStatus
from sentry.integrations.models.repository_project_path_config import RepositoryProjectPathConfig
from sentry.models.commit import Commit
from sentry.models.commitauthor import CommitAuthor
from sentry.models.projectrepository import ProjectRepository, ProjectRepositorySource
from sentry.models.pullrequest import PullRequest
from sentry.models.repository import Repository
from sentry.seer.models.project_repository import SeerProjectRepository
from sentry.tasks.repository import repository_cascade_delete_on_hide
from sentry.testutils.cases import TestCase


class RepositoryCascadeDeleteOnHideTest(TestCase):
    def test_deletes_child_relations(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        _, org_integration = self.create_provider_integration_for(
            org, self.user, provider="github", name="Example", external_id="abcd"
        )
        repo = Repository.objects.create(
            organization_id=org.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.HIDDEN,
        )
        commit_author = CommitAuthor.objects.create(
            organization_id=org.id,
            name="Sally",
            email="sally@example.org",
        )
        commit = Commit.objects.create(
            repository_id=repo.id,
            organization_id=org.id,
            key="1234abcd",
            author=commit_author,
        )
        pull_request = PullRequest.objects.create(
            organization_id=org.id,
            repository_id=repo.id,
            key="42",
            title="fix bugs",
            message="various fixes",
            author=commit_author,
        )
        project_repo, _ = ProjectRepository.objects.get_or_create(
            project=project,
            repository=repo,
            defaults={"source": ProjectRepositorySource.MANUAL},
        )
        code_mapping = RepositoryProjectPathConfig.objects.create(
            project=project,
            repository=repo,
            stack_root="",
            source_root="src/packages/store",
            default_branch="main",
            organization_integration_id=org_integration.id,
            integration_id=org_integration.integration_id,
            organization_id=org_integration.organization_id,
            project_repository=project_repo,
        )

        repository_cascade_delete_on_hide(repo_id=repo.id)

        assert not Commit.objects.filter(id=commit.id).exists()
        assert not PullRequest.objects.filter(id=pull_request.id).exists()
        assert not RepositoryProjectPathConfig.objects.filter(id=code_mapping.id).exists()

    def test_preserves_seer_project_repository(self) -> None:
        org = self.create_organization()
        project = self.create_project(organization=org)
        repo = Repository.objects.create(
            organization_id=org.id,
            provider="dummy",
            name="example/example",
            status=ObjectStatus.HIDDEN,
        )
        seer_project_repo = self.create_seer_project_repository(
            project=project,
            repository=repo,
        )

        repository_cascade_delete_on_hide(repo_id=repo.id)

        assert SeerProjectRepository.objects.filter(id=seer_project_repo.id).exists()
