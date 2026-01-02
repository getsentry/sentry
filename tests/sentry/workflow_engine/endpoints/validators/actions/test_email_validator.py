from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestEmailActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.team = self.create_team(organization=self.organization)
        self.valid_data = {
            "type": Action.Type.EMAIL,
            "config": {"targetType": "user", "targetIdentifier": str(self.user.id)},
            "data": {},
        }

    def test_validate__user(self) -> None:
        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is True

    def test_validate_user__missing_identifier(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"target_type": "user"},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is False

    def test_validate__team(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {
                    "target_type": "team",
                    "target_identifier": str(self.team.id),
                },
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid(raise_exception=True)
        assert result is True

    def test_validate__issue_owners(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"target_type": "issue_owners"},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid(raise_exception=True)
        assert result is True

    def test_validate__invalid_target_type(self) -> None:
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"targetType": "specific"},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is False
