from sentry.db.models.fields.encryption import EncryptedJSONField
from sentry.integrations.models.integration import Integration
from sentry.testutils.cases import TestCase


class IntegrationSecurityTest(TestCase):
    def test_metadata_field_is_encrypted_json(self) -> None:
        assert isinstance(Integration._meta.get_field("metadata"), EncryptedJSONField)
