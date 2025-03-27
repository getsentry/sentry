from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.base import BaseDataConditionGroupValidator
from sentry.workflow_engine.models import Condition, DataConditionGroup


class TestBaseDataConditionGroupValidator(TestCase):
    def setUp(self):
        self.valid_data = {
            "logicType": DataConditionGroup.Type.ANY,
            "organizationId": self.organization.id,
            "conditions": [],
        }

    def test_validator__conditions__empty(self):
        validator = BaseDataConditionGroupValidator(data=self.valid_data)
        assert validator.is_valid() is True

    def test_validator__conditions__valid_conditions(self):
        condition_group = self.create_data_condition_group()
        self.valid_data["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
                "conditionGroup": condition_group.id,
            },
            {
                "type": Condition.GREATER,
                "comparison": 0,
                "conditionResult": True,
                "conditionGroup": condition_group.id,
            },
        ]
        validator = BaseDataConditionGroupValidator(data=self.valid_data)

        assert validator.is_valid() is True

    def test_validator__conditions__invalid_condition(self):
        self.valid_data["conditions"] = [
            {
                "comparison": 0,
            }
        ]
        validator = BaseDataConditionGroupValidator(data=self.valid_data)
        assert validator.is_valid() is False

    def test_create_data_condition_group__no_conditions(self):
        validator = BaseDataConditionGroupValidator(data=self.valid_data)
        assert validator.is_valid(), validator.errors

        # TODO - Create a context and pass it to the create method
        condition_group, data_conditions = validator.create(validator.validated_data)

        assert condition_group.logic_type == self.valid_data["logicType"]
        assert data_conditions == self.valid_data["conditions"]

    def test_create_data_condition_group__one_condition(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
            }
        ]
        validator = BaseDataConditionGroupValidator(data=self.valid_data)
        assert validator.is_valid(), validator.errors

        # TODO - Create a context and pass it to the create method
        condition_group, data_conditions = validator.create(validator.validated_data)

        # validate the condition
        assert data_conditions[0].type == self.valid_data["conditions"][0]["type"]
        assert data_conditions[0].comparison == self.valid_data["conditions"][0]["comparison"]

    def test_create_data_condition_group__many_conditions(self):
        self.valid_data["conditions"] = [
            {
                "type": Condition.EQUAL,
                "comparison": 1,
                "conditionResult": True,
            },
            {
                "type": Condition.GREATER,
                "comparison": 0,
                "conditionResult": True,
            },
        ]

        validator = BaseDataConditionGroupValidator(data=self.valid_data)
        assert validator.is_valid(), validator.errors

        # TODO - Create a context and pass it to the create method
        condition_group, data_conditions = validator.create(validator.validated_data)

        assert len(data_conditions) == len(self.valid_data["conditions"])
        assert data_conditions[0].type == self.valid_data["conditions"][0]["type"]
        assert data_conditions[1].type == self.valid_data["conditions"][1]["type"]
