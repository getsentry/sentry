import asyncio
import concurrent.futures as cf

from django.urls import reverse

from sentry.testutils.cases import APITestCase
from sentry.utils import flag


def test_flag_tracking():
    """Assert the ring buffer works."""
    flag.initialize_flag_manager(capacity=3)

    flag.process_flag_result("a", True)
    flags = flag.get_flags_serialized()
    assert len(flags) == 1
    assert flags == [{"flag": "feature.a", "result": True}]

    flag.process_flag_result("b", True)
    flags = flag.get_flags_serialized()
    assert len(flags) == 2
    assert flags == [{"flag": "feature.a", "result": True}, {"flag": "feature.b", "result": True}]

    flag.process_flag_result("c", True)
    flags = flag.get_flags_serialized()
    assert len(flags) == 3
    assert flags == [
        {"flag": "feature.a", "result": True},
        {"flag": "feature.b", "result": True},
        {"flag": "feature.c", "result": True},
    ]

    flag.process_flag_result("d", False)
    flags = flag.get_flags_serialized()
    assert len(flags) == 3
    assert flags == [
        {"flag": "feature.b", "result": True},
        {"flag": "feature.c", "result": True},
        {"flag": "feature.d", "result": False},
    ]

    flag.process_flag_result("e", False)
    flag.process_flag_result("f", False)
    flags = flag.get_flags_serialized()
    assert len(flags) == 3
    assert flags == [
        {"flag": "feature.d", "result": False},
        {"flag": "feature.e", "result": False},
        {"flag": "feature.f", "result": False},
    ]


def test_flag_manager_asyncio_isolation():
    """Assert concurrently evaluated flags do not pollute one another."""

    async def task(chars: str):
        flag.initialize_flag_manager(capacity=3)
        for char in chars:
            flag.process_flag_result(char, True)
        return flag.get_flags_serialized()

    async def runner():
        return asyncio.gather(
            task("abc"),
            task("de"),
            task("fghijk"),
        )

    results = asyncio.run(runner()).result()

    assert results[0] == [
        {"flag": "feature.a", "result": True},
        {"flag": "feature.b", "result": True},
        {"flag": "feature.c", "result": True},
    ]
    assert results[1] == [
        {"flag": "feature.d", "result": True},
        {"flag": "feature.e", "result": True},
    ]
    assert results[2] == [
        {"flag": "feature.i", "result": True},
        {"flag": "feature.j", "result": True},
        {"flag": "feature.k", "result": True},
    ]


def test_flag_manager_thread_isolation():
    """Assert concurrently evaluated flags do not pollute one another."""

    def task(chars: str):
        flag.initialize_flag_manager(capacity=3)
        for char in chars:
            flag.process_flag_result(char, True)
        return flag.get_flags_serialized()

    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(task, ["abc", "de", "fghijk"]))

    assert results[0] == [
        {"flag": "feature.a", "result": True},
        {"flag": "feature.b", "result": True},
        {"flag": "feature.c", "result": True},
    ]
    assert results[1] == [
        {"flag": "feature.d", "result": True},
        {"flag": "feature.e", "result": True},
    ]
    assert results[2] == [
        {"flag": "feature.i", "result": True},
        {"flag": "feature.j", "result": True},
        {"flag": "feature.k", "result": True},
    ]


class E2EAPITestCase(APITestCase):
    endpoint = "sentry-api-0-organization-replay-index"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)
        self.url = reverse(self.endpoint, args=(self.organization.slug,))

    def test_contextvar_initialized(self):
        """Test replays must be used with a project(s)."""
        self.client.get(self.url)

        flags = flag.get_flags_serialized()
        assert flags[-1]["flag"] == "feature.organizations:session-replay"
        assert flags[-1]["result"] is False
