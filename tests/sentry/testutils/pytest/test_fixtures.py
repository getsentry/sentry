from unittest import mock

from sentry.testutils.cases import SnubaTestCase, TestCase
from sentry.testutils.helpers.datetime import before_now
from sentry.utils.snuba import _snuba_pool


def _create_group_and_store_event(case: TestCase) -> list[str]:
    with mock.patch.object(_snuba_pool, "urlopen", wraps=_snuba_pool.urlopen) as urlopen:
        case.create_group()
        case.store_event(
            data={"message": "hello", "timestamp": before_now(minutes=1).isoformat()},
            project_id=case.project.id,
        )
    return [call.args[1] for call in urlopen.call_args_list]


class SkipSnubaWritesTest(TestCase):
    def test_skips_snuba_writes(self) -> None:
        assert _create_group_and_store_event(self) == []


class SnubaWritesTest(TestCase, SnubaTestCase):
    def test_sends_snuba_writes(self) -> None:
        paths = _create_group_and_store_event(self)
        assert "/tests/entities/group_attributes/insert" in paths
        assert "/tests/events/eventstream" in paths
