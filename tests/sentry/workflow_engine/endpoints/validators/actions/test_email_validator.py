from sentry.notifications.models.notificationaction import ActionTarget
from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseActionValidator
from sentry.workflow_engine.models import Action


class TestEmailActionValidator(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.team = self.create_team(organization=self.organization)
        self.valid_data = {
            "type": Action.Type.EMAIL,
            "config": {"targetType": ActionTarget.USER, "targetIdentifier": str(self.user.id)},
            "data": {},
        }

    def test_validate__user(self):
        validator = BaseActionValidator(
            data=self.valid_data,
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is True

    def test_validate_user__missing_identifier(self):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"target_type": ActionTarget.USER},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is False

    def test_validate__team(self):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {
                    "target_type": ActionTarget.TEAM,
                    "target_identifier": str(self.team.id),
                },
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is True

    def test_validate__issue_owners(self):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"target_type": ActionTarget.ISSUE_OWNERS},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is True

    def test_validate__invalid_target_type(self):
        validator = BaseActionValidator(
            data={
                **self.valid_data,
                "config": {"targetType": ActionTarget.SPECIFIC},
            },
            context={"organization": self.organization},
        )
        result = validator.is_valid()
        assert result is False
