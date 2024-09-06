import asyncio
import concurrent.futures as cf

from sentry.utils import flag


def test_flag_tracking():
    """Assert the ring buffer works."""
    flag.initialize_flag_manager(3)

    flag.process_flag_result("a", True)
    flags = flag.get_flags_serialized()
    assert len(flags) == 1
    assert flags == [{"flag": "a", "result": True}]

    flag.process_flag_result("b", True)
    flags = flag.get_flags_serialized()
    assert len(flags) == 2
    assert flags == [{"flag": "a", "result": True}, {"flag": "b", "result": True}]

    flag.process_flag_result("c", True)
    flags = flag.get_flags_serialized()
    assert len(flags) == 3
    assert flags == [
        {"flag": "a", "result": True},
        {"flag": "b", "result": True},
        {"flag": "c", "result": True},
    ]

    flag.process_flag_result("d", False)
    flags = flag.get_flags_serialized()
    assert len(flags) == 3
    assert flags == [
        {"flag": "b", "result": True},
        {"flag": "c", "result": True},
        {"flag": "d", "result": False},
    ]

    flag.process_flag_result("e", False)
    flag.process_flag_result("f", False)
    flags = flag.get_flags_serialized()
    assert len(flags) == 3
    assert flags == [
        {"flag": "d", "result": False},
        {"flag": "e", "result": False},
        {"flag": "f", "result": False},
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
        {"flag": "a", "result": True},
        {"flag": "b", "result": True},
        {"flag": "c", "result": True},
    ]
    assert results[1] == [
        {"flag": "d", "result": True},
        {"flag": "e", "result": True},
    ]
    assert results[2] == [
        {"flag": "i", "result": True},
        {"flag": "j", "result": True},
        {"flag": "k", "result": True},
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
        {"flag": "a", "result": True},
        {"flag": "b", "result": True},
        {"flag": "c", "result": True},
    ]
    assert results[1] == [
        {"flag": "d", "result": True},
        {"flag": "e", "result": True},
    ]
    assert results[2] == [
        {"flag": "i", "result": True},
        {"flag": "j", "result": True},
        {"flag": "k", "result": True},
    ]
