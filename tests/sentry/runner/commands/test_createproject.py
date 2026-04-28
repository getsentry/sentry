from sentry.models.project import Project
from sentry.models.projectkey import ProjectKey
from sentry.runner.commands.createproject import createproject
from sentry.testutils.cases import CliTestCase


class CreateProjectTest(CliTestCase):
    command = createproject
    default_args: list[str] = []

    def test_basic_creation_with_org_slug(self) -> None:
        org = self.create_organization(name="test-org")
        rv = self.invoke("--name=My Project", "--platform=python", f"--organization={org.slug}")
        assert rv.exit_code == 0, rv.output

        project = Project.objects.get(organization=org, name="My Project")
        assert project.platform == "python"
        assert f"ID: {project.id}" in rv.output
        assert f"Slug: {project.slug}" in rv.output

        key = ProjectKey.get_default(project)
        assert key is not None
        assert f"DSN: {key.dsn_public}" in rv.output

    def test_basic_creation_with_org_id(self) -> None:
        org = self.create_organization(name="test-org")
        rv = self.invoke("--name=My Project", "--platform=python", f"--organization={org.id}")
        assert rv.exit_code == 0, rv.output

        project = Project.objects.get(organization=org, name="My Project")
        assert project.platform == "python"

    def test_with_team(self) -> None:
        org = self.create_organization(name="test-org")
        team = self.create_team(organization=org, slug="backend")
        rv = self.invoke(
            "--name=My Project",
            "--platform=javascript-react",
            f"--organization={org.slug}",
            f"--team={team.slug}",
        )
        assert rv.exit_code == 0, rv.output

        project = Project.objects.get(organization=org, name="My Project")
        assert team in project.teams.all()

    def test_invalid_organization(self) -> None:
        rv = self.invoke("--name=My Project", "--platform=python", "--organization=nonexistent")
        assert rv.exit_code != 0
        assert "Organization not found" in rv.output

    def test_invalid_team(self) -> None:
        org = self.create_organization(name="test-org")
        rv = self.invoke(
            "--name=My Project",
            "--platform=python",
            f"--organization={org.slug}",
            "--team=nonexistent",
        )
        assert rv.exit_code != 0
        assert "Team not found" in rv.output
