from __future__ import annotations

from contextlib import contextmanager
from time import time
from typing import Any
from unittest import mock

from sentry.event_manager import _create_group
from sentry.eventstore.models import Event
from sentry.grouping.ingest import (
    _calculate_primary_hash,
    _calculate_secondary_hash,
    find_existing_grouphash,
)
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.mocking import capture_return_values
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


LEGACY_CONFIG = "legacy:2019-03-12"
NEWSTYLE_CONFIG = "newstyle:2023-01-11"


@contextmanager
def patch_grouping_helpers(return_values: dict[str, Any]):
    wrapped_find_existing_grouphash = capture_return_values(find_existing_grouphash, return_values)
    wrapped_calculate_primary_hash = capture_return_values(_calculate_primary_hash, return_values)
    wrapped_calculate_secondary_hash = capture_return_values(
        _calculate_secondary_hash, return_values
    )

    with (
        mock.patch(
            "sentry.event_manager.find_existing_grouphash",
            wraps=wrapped_find_existing_grouphash,
        ) as find_existing_grouphash_spy,
        mock.patch(
            "sentry.grouping.ingest._calculate_primary_hash",
            wraps=wrapped_calculate_primary_hash,
        ) as calculate_primary_hash_spy,
        mock.patch(
            "sentry.grouping.ingest._calculate_secondary_hash",
            wraps=wrapped_calculate_secondary_hash,
        ) as calculate_secondary_hash_spy,
        mock.patch(
            "sentry.event_manager._create_group",
            # No return-value-wrapping necessary here, since all we need
            # is the group id, and that's stored on the event
            wraps=_create_group,
        ) as create_group_spy,
    ):
        yield {
            "find_existing_grouphash": find_existing_grouphash_spy,
            "_calculate_primary_hash": calculate_primary_hash_spy,
            "_calculate_secondary_hash": calculate_secondary_hash_spy,
            "_create_group": create_group_spy,
        }


def set_grouping_configs(
    project: Project,
    primary_config: str,
    secondary_config: str | None,
    transition_expiry: float | None = None,
    in_transition: bool = False,
):
    project.update_option("sentry:grouping_config", primary_config)
    project.update_option("sentry:secondary_grouping_config", secondary_config)
    if in_transition:
        project.update_option(
            "sentry:secondary_grouping_expiry", transition_expiry or time() + 3600
        )
    else:
        project.update_option("sentry:secondary_grouping_expiry", None)


def save_event_with_grouping_config(
    event_data: dict[str, Any],
    project: Project,
    primary_config: str,
    secondary_config: str | None = None,
    in_transition: bool = False,
) -> Event:
    """
    Create an event with the given grouping config, by temporarily changing project options before
    saving an event. Resets options to current values once the event is saved.
    """
    current_primary_config = project.get_option("sentry:grouping_config")
    current_secondary_config = project.get_option("sentry:secondary_grouping_config")
    current_transition_expiry = project.get_option("sentry:secondary_grouping_expiry")

    set_grouping_configs(
        project=project,
        primary_config=primary_config,
        secondary_config=secondary_config,
        in_transition=in_transition,
    )
    event = save_new_event(event_data, project)

    # Reset project options
    set_grouping_configs(
        project=project,
        primary_config=current_primary_config,
        secondary_config=current_secondary_config,
        transition_expiry=current_transition_expiry,
        in_transition=True,  # Force transition expiry to be set, even if it's None
    )

    return event


def get_results_from_saving_event(
    event_data: dict[str, Any],
    project: Project,
    primary_config: str,
    secondary_config: str,
    in_transition: bool,
    existing_group_id: int | None = None,
):
    # Whether or not these are assigned a value depends on the values of `in_transition` and
    # `existing_group_id`. Everything else we'll return will definitely get a value and therefore
    # doesn't need to be initialized.
    secondary_hash_calculated = None
    hashes_different = None
    secondary_hash_found = None
    event_assigned_to_given_existing_group = None
    secondary_grouphash_existed_already = None
    secondary_grouphash_exists_now = None

    existing_grouphashes = {
        gh.hash: gh.group_id for gh in GroupHash.objects.filter(project_id=project.id)
    }

    return_values: dict[str, list[Any]] = {}

    with patch_grouping_helpers(return_values) as spies:
        calculate_secondary_hash_spy = spies["_calculate_secondary_hash"]
        create_group_spy = spies["_create_group"]
        calculate_primary_hash_spy = spies["_calculate_primary_hash"]

        set_grouping_configs(
            project=project,
            primary_config=primary_config,
            secondary_config=secondary_config,
            in_transition=in_transition,
        )

        new_event = save_new_event(event_data, project)
        hash_search_result = return_values["find_existing_grouphash"][0][0]
        post_save_grouphashes = {
            gh.hash: gh.group_id for gh in GroupHash.objects.filter(project_id=project.id)
        }

        # We should never call any of these more than once, regardless of the test
        assert calculate_primary_hash_spy.call_count <= 1
        assert calculate_secondary_hash_spy.call_count <= 1
        assert create_group_spy.call_count <= 1

        primary_hash_calculated = calculate_primary_hash_spy.call_count == 1
        secondary_hash_calculated = calculate_secondary_hash_spy.call_count == 1

        primary_hash = return_values["_calculate_primary_hash"][0].hashes[0]
        primary_hash_found = bool(hash_search_result) and hash_search_result.hash == primary_hash

        new_group_created = create_group_spy.call_count == 1

        primary_grouphash_existed_already = primary_hash in existing_grouphashes
        primary_grouphash_exists_now = primary_hash in post_save_grouphashes

        # Sanity checks
        if primary_grouphash_existed_already:
            existing_primary_hash_group_id = existing_grouphashes.get(primary_hash)
            post_save_primary_hash_group_id = post_save_grouphashes.get(primary_hash)
            assert (
                post_save_primary_hash_group_id == existing_primary_hash_group_id
            ), "Existing primary hash's group id changed"
            assert (
                existing_group_id
            ), "Primary grouphash already exists. Either something's wrong or you forgot to pass an existing group id"

        if existing_group_id:
            event_assigned_to_given_existing_group = (
                new_event.group_id == existing_group_id if existing_group_id else None
            )

        if secondary_hash_calculated:
            secondary_hash = return_values["_calculate_secondary_hash"][0].hashes[0]
            hashes_different = secondary_hash != primary_hash
            secondary_hash_found = (
                bool(hash_search_result) and hash_search_result.hash == secondary_hash
            )
            secondary_grouphash_existed_already = secondary_hash in existing_grouphashes
            secondary_grouphash_exists_now = secondary_hash in post_save_grouphashes

            # More sanity checks
            if secondary_grouphash_existed_already:
                existing_secondary_hash_group_id = existing_grouphashes.get(secondary_hash)
                post_save_secondary_hash_group_id = post_save_grouphashes.get(secondary_hash)
                assert (
                    post_save_secondary_hash_group_id == existing_secondary_hash_group_id
                ), "Existing secondary hash's group id changed"
                assert (
                    existing_group_id
                ), "Secondary grouphash already exists. Either something's wrong or you forgot to pass an existing group id"

        return {
            "primary_hash_calculated": primary_hash_calculated,
            "secondary_hash_calculated": secondary_hash_calculated,
            "hashes_different": hashes_different,
            "primary_hash_found": primary_hash_found,
            "secondary_hash_found": secondary_hash_found,
            "new_group_created": new_group_created,
            "event_assigned_to_given_existing_group": event_assigned_to_given_existing_group,
            "primary_grouphash_existed_already": primary_grouphash_existed_already,
            "secondary_grouphash_existed_already": secondary_grouphash_existed_already,
            "primary_grouphash_exists_now": primary_grouphash_exists_now,
            "secondary_grouphash_exists_now": secondary_grouphash_exists_now,
        }
