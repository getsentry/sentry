from django.utils import timezone

from sentry.flags.models import ACTION_MAP, CREATED_BY_TYPE_MAP
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
        res = handle_provider_event("launchdarkly", request_data, self.organization.id)
        assert len(res) == 1
        flag_row = res[0]
        assert flag_row["action"] == ACTION_MAP["deleted"]
        assert flag_row["flag"] == "Example Flag Name"
        assert flag_row["created_by"] == "jd@test.com"
        assert flag_row["created_by_type"] == CREATED_BY_TYPE_MAP["email"]
        assert flag_row["organization_id"] == self.organization.id
        assert flag_row["tags"] is not None
