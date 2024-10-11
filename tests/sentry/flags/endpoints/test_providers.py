from django.utils import timezone

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP, FlagAuditLogModel
from sentry.flags.providers import handle_provider_event
from sentry.testutils.cases import APITestCase


class FlagProviderTestCase(APITestCase):
    default_timezone = timezone.get_default_timezone()

    def test_handle_launchdarkly_provider_event(self):
        request_data = {
            "_links": {
                "property1": {"href": "string", "type": "string"},
                "property2": {"href": "string", "type": "string"},
            },
            "_id": "12345",
            "_accountId": "67890",
            "date": 1728680051000,
            "accesses": [{"action": "deleteFlag", "resource": "string"}],
            "kind": "string",
            "name": "Example Flag Name",
            "description": "Example, turning on the flag for testing",
            "shortDescription": "Example, turning on the flag",
            "comment": "This is an automated test",
            "subject": {
                "_links": {
                    "property1": {"href": "string", "type": "string"},
                    "property2": {"href": "string", "type": "string"},
                },
                "name": "string",
                "avatarUrl": "string",
            },
            "member": {
                "_links": {
                    "property1": {"href": "string", "type": "string"},
                    "property2": {"href": "string", "type": "string"},
                },
                "_id": "507f1f77bcf86cd799439011",
                "email": "jd@test.com",
                "firstName": "John",
                "lastName": "Doe",
            },
            "titleVerb": "turned on the flag",
        }
        handle_provider_event("launchdarkly", request_data, self.organization.id)
        assert FlagAuditLogModel.objects.count() == 1
        flag = FlagAuditLogModel.objects.first()
        assert flag is not None
        assert flag.action == ACTION_MAP["deleted"]
        assert flag.flag == "Example Flag Name"
        assert flag.created_by == "jd@test.com"
        assert flag.created_by_type == CREATED_BY_TYPE_MAP["email"]
        assert flag.organization_id == self.organization.id
        assert flag.tags is not None
