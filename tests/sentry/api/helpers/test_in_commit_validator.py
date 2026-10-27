from sentry.api.helpers.group_index.validators.in_commit import InCommitValidator
from sentry.testutils.cases import TestCase


class InCommitValidatorTest(TestCase):
    def test_duplicate_repository_name_is_disambiguated_by_commit(self) -> None:
        repo = self.create_repo(project=self.project, name=self.project.name)
        commit = self.create_commit(project=self.project, repo=repo)
        self.create_repo(
            project=self.project,
            name=repo.name,
            provider="integrations:github",
            external_id="duplicate-repository",
        )
        validator = InCommitValidator(
            data={"commit": commit.key, "repository": repo.name},
            context={"project": self.project},
        )

        assert validator.is_valid(), validator.errors
        assert validator.validated_data == commit
