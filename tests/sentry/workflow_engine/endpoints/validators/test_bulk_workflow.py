from sentry.testutils.cases import TestCase
from sentry.workflow_engine.endpoints.validators.bulk_workflow import (
    BulkWorkflowMutationValidator,
    BulkWorkflowUpdateValidator,
)


class BulkWorkflowValidatorTest(TestCase):
    def test_update_validator_with_valid_request(self):
        request = self.make_request(GET={"id": ["1", "2"], "query": "test"})
        request.data = {
            "enabled": True,
        }
        context = {
            "organization": self.organization,
            "request": request,
        }

        validator = BulkWorkflowUpdateValidator(context=context)
        assert validator.is_valid()
        assert validator.validated_data["id"] == [1, 2]
        assert validator.validated_data["query"] == "test"
        assert validator.validated_data["enabled"] is True

    def test_update_validator_missing_enabled(self):
        request = self.make_request(GET={"id": ["1", "2"], "query": "test"})
        request.data = {}
        context = {
            "organization": self.organization,
            "request": request,
        }

        validator = BulkWorkflowUpdateValidator(context=context)
        assert not validator.is_valid()
        assert "enabled" in validator.errors

    def test_update_validator_no_filtering_params(self):
        request = self.make_request()
        request.data = {
            "enabled": True,
        }
        context = {
            "organization": self.organization,
            "request": request,
        }

        validator = BulkWorkflowUpdateValidator(context=context)
        assert not validator.is_valid()
        assert "detail" in validator.errors

    def test_mutate_validator_with_valid_request(self):
        context = {
            "organization": self.organization,
            "request": self.make_request(GET={"id": ["1", "2"], "query": "test"}),
        }

        validator = BulkWorkflowMutationValidator(context=context)
        assert validator.is_valid()
        assert validator.validated_data["id"] == [1, 2]
        assert validator.validated_data["query"] == "test"

    def test_mutate_validator_no_filtering_params(self):
        context = {
            "organization": self.organization,
            "request": self.make_request(),
        }

        validator = BulkWorkflowMutationValidator(context=context)
        assert not validator.is_valid()
        assert "detail" in validator.errors
