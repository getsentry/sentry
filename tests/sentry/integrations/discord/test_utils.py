from sentry.integrations.discord.utils.auth import verify_signature
from sentry.testutils.cases import TestCase


class AuthTest(TestCase):
    def test_verify_signature_valid(self):
        public_key_string = "a1a65ae9a8ef39b446c35f13fc2ab2e6c4cc734a29b1ec4331d597466e071657"
        signature = "0736274439da0c97afab9fdeed624f62a9eed0d332b0154f2e7f88e7da7c434243a4cd60e987c2d7c55b467da452cc0cfb96268bcb8df5e3998d10cb2b700909"
        timestamp = "1688960024"
        body = '{"application_id":"1113955448580735026","entitlements":[],"id":"1127804826542161952","token":"aW50ZXJhY3Rpb246MTEyNzgwNDgyNjU0MjE2MTk1MjpLWFpnNWkzNmlEa0pOWFlhS1BrU0gzSXR0ZUxsOUFNbTJZRFpLc3BIQlVUdlNkWmtSUnV0MzZkejhKd3FjTERCUUVBWXVkWlk5d2FsSTJXZjBUQmd4MmdwZDk5eU5GZlFocGhjQ2pmbGhQaXFUTWRVRGtZZXJXTU1CaE5QZVgzTg","type":1,"user":{"avatar":"1d978b8af2bf7addf673c05ca511dbfa","avatar_decoration":null,"discriminator":"0","global_name":"spalmurray-sentry","id":"1105971768394518731","public_flags":0,"username":"spalmurraysentry"},"version":1}'
        message = timestamp + body

        result = verify_signature(public_key_string, signature, message)

        assert result

    def test_verify_signature_invalid(self):
        public_key_string = "a1a65ae9a8ef39b446c35f13fc2ab2e6c4cc734a29b1ec4331d597466e071657"
        signature = "0123456789abcdef"
        timestamp = "1688960024"
        body = '{"application_id":"1113955448580735026","entitlements":[],"id":"1127804826542161952","token":"aW50ZXJhY3Rpb246MTEyNzgwNDgyNjU0MjE2MTk1MjpLWFpnNWkzNmlEa0pOWFlhS1BrU0gzSXR0ZUxsOUFNbTJZRFpLc3BIQlVUdlNkWmtSUnV0MzZkejhKd3FjTERCUUVBWXVkWlk5d2FsSTJXZjBUQmd4MmdwZDk5eU5GZlFocGhjQ2pmbGhQaXFUTWRVRGtZZXJXTU1CaE5QZVgzTg","type":1,"user":{"avatar":"1d978b8af2bf7addf673c05ca511dbfa","avatar_decoration":null,"discriminator":"0","global_name":"spalmurray-sentry","id":"1105971768394518731","public_flags":0,"username":"spalmurraysentry"},"version":1}'
        message = timestamp + body

        result = verify_signature(public_key_string, signature, message)

        assert not result
