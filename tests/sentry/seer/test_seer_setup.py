from django.test import override_settings

from sentry.seer.seer_setup import (
    has_seer_access,
    has_seer_access_with_detail,
    is_seer_available,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class IsSeerAvailableTest(TestCase):
    @override_settings(SENTRY_SELF_HOSTED=False)
    def test_available_on_saas(self) -> None:
        assert is_seer_available() is True

    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_unavailable_on_self_hosted(self) -> None:
        assert is_seer_available() is False


@override_settings(SENTRY_SELF_HOSTED=False)
class HasSeerAccessTest(TestCase):
    @with_feature("organizations:gen-ai-features")
    def test_allowed(self) -> None:
        org = self.create_organization()
        assert has_seer_access(org) is True
        assert has_seer_access_with_detail(org) == (True, None)

    def test_denied_without_flag(self) -> None:
        org = self.create_organization()
        assert has_seer_access(org) is False
        assert has_seer_access_with_detail(org) == (False, "Feature flag not enabled")

    @with_feature("organizations:gen-ai-features")
    def test_denied_when_hidden(self) -> None:
        org = self.create_organization()
        org.update_option("sentry:hide_ai_features", True)
        assert has_seer_access(org) is False
        assert has_seer_access_with_detail(org) == (
            False,
            "AI features are disabled for this organization.",
        )

    @with_feature("organizations:gen-ai-features")
    @override_settings(SENTRY_SELF_HOSTED=True)
    def test_denied_on_self_hosted(self) -> None:
        org = self.create_organization()
        assert has_seer_access(org) is False
        assert has_seer_access_with_detail(org) == (False, "Feature flag not enabled")
