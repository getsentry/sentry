from sentry.investigations.access import has_investigations_access
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.features import with_feature


class HasInvestigationsAccessTest(TestCase):
    def set_open_membership(self, enabled: bool) -> None:
        self.organization.flags.allow_joinleave = enabled
        self.organization.save()

    @with_feature("organizations:investigations")
    def test_feature_and_open_membership(self) -> None:
        self.set_open_membership(True)

        assert has_investigations_access(self.organization, actor=self.user) is True

    def test_requires_the_feature(self) -> None:
        self.set_open_membership(True)

        assert has_investigations_access(self.organization, actor=self.user) is False

    @with_feature("organizations:investigations")
    def test_requires_open_membership(self) -> None:
        self.set_open_membership(False)

        assert has_investigations_access(self.organization, actor=self.user) is False
