from sentry.issues.action_log.types import GroupAction, GroupActionType
from sentry.testutils.cases import TestCase


class GroupActionRegistrationTest(TestCase):
    def test_all_types_are_registered(self) -> None:
        missing = [member for member in GroupActionType if GroupAction.by_type(member) is None]
        assert missing == [], (
            f"GroupActionType members without a registered GroupAction subclass: "
            f"{[m.name for m in missing]}"
        )
