from sentry.unmerge import (
    InitialUnmergeArgs,
    PrimaryHashUnmergeReplacement,
    SuccessiveUnmergeArgs,
    UnmergeArgsBase,
)


def test_argument_parsing_endpoint():
    """
    Tests task invocations done from group_hashes endpoint.
    """
    args = UnmergeArgsBase.parse_arguments(123, 345, None, ["a" * 32], None)
    assert args == InitialUnmergeArgs(
        project_id=123,
        source_id=345,
        destinations={},
        replacement=PrimaryHashUnmergeReplacement(
            fingerprints=["a" * 32],
        ),
        actor_id=None,
        batch_size=500,
    )

    dumped = args.dump_arguments()
    assert dumped == {
        "actor_id": None,
        "batch_size": 500,
        "destination_id": None,
        "destinations": {},
        "fingerprints": None,
        "project_id": 123,
        "replacement": {
            "fingerprints": [
                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            ],
            "type": "primary_hash",
        },
        "source_id": 345,
    }

    assert UnmergeArgsBase.parse_arguments(**dumped) == args


def test_argument_parsing_page2():
    """
    Tests task invocations done from an older version of the unmerge task.
    This test only exists such that argument parsing is not broken across
    deploys, but in a few years it may be fine to break compat with old queue
    items and remove this test.
    """

    args = UnmergeArgsBase.parse_arguments(
        123,
        345,
        567,
        ["a" * 32],
        666,
        last_event={"hello": "world"},
        batch_size=500,
        source_fields_reset=True,
        eventstream_state={"state": True},
    )

    assert args == SuccessiveUnmergeArgs(
        project_id=123,
        source_id=345,
        destinations={"default": (567, {"state": True})},
        replacement=PrimaryHashUnmergeReplacement(fingerprints=["a" * 32]),
        actor_id=666,
        last_event={"hello": "world"},
        locked_primary_hashes=["a" * 32],
        batch_size=500,
        source_fields_reset=True,
    )

    assert UnmergeArgsBase.parse_arguments(**args.dump_arguments()) == args
