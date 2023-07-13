from sentry.integrations.discord.utils.auth import verify_signature
from sentry.testutils.cases import TestCase


class AuthTest(TestCase):
    def test_verify_signature_valid(self):
        public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
        signature = "DBC99471F8DD30BA0F488912CF9BA7AC1E938047782BB72FF9A6873D452A1A75DC9F8A07182B8EB7FC67A3771C2271D568DCDC2AB2A5D927A42A4F0FC233C506"
        timestamp = "1688960024"
        body = '{"type":1}'
        message = timestamp + body

        result = verify_signature(public_key_string, signature, message)

        assert result

    def test_verify_signature_invalid(self):
        public_key_string = "3AC1A3E56E967E1C61E3D17B37FA1865CB20CD6C54418631F4E8AE4D1E83EE0E"
        signature = "0123456789abcdef"
        timestamp = "1688960024"
        body = '{"type":1}'
        message = timestamp + body

        result = verify_signature(public_key_string, signature, message)

        assert not result
