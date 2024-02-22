from __future__ import annotations

from contextlib import contextmanager
from time import time
from typing import Any
from unittest import mock

import pytest

from sentry.event_manager import _create_group
from sentry.eventstore.models import Event
from sentry.grouping.ingest import (
    _calculate_primary_hash,
    _calculate_secondary_hash,
    find_existing_grouphash,
    find_existing_grouphash_new,
)
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.features import Feature
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import capture_results
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


LEGACY_CONFIG = "legacy:2019-03-12"
NEWSTYLE_CONFIG = "newstyle:2023-01-11"


@contextmanager
def patch_grouping_helpers(return_values: dict[str, Any]):
    wrapped_find_existing_grouphash = capture_results(find_existing_grouphash, return_values)
    wrapped_find_existing_grouphash_new = capture_results(
        find_existing_grouphash_new, return_values
    )
    wrapped_calculate_primary_hash = capture_results(_calculate_primary_hash, return_values)
    wrapped_calculate_secondary_hash = capture_results(_calculate_secondary_hash, return_values)

    with (
        mock.patch(
            "sentry.event_manager.find_existing_grouphash",
            wraps=wrapped_find_existing_grouphash,
        ) as find_existing_grouphash_spy,
        mock.patch(
            "sentry.event_manager.find_existing_grouphash_new",
            wraps=wrapped_find_existing_grouphash_new,
        ) as find_existing_grouphash_new_spy,
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
            "find_existing_grouphash_new": find_existing_grouphash_new_spy,
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
    new_logic_enabled: bool = False,
):
    find_existing_grouphash_fn = (
        "find_existing_grouphash_new" if new_logic_enabled else "find_existing_grouphash"
    )

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

    with (
        patch_grouping_helpers(return_values) as spies,
        Feature({"organizations:grouping-suppress-unnecessary-secondary-hash": new_logic_enabled}),
    ):
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
        post_save_grouphashes = {
            gh.hash: gh.group_id for gh in GroupHash.objects.filter(project_id=project.id)
        }

        hash_search_results = return_values[find_existing_grouphash_fn]
        # The current logic wraps the search result in an extra layer which we need to unwrap
        if not new_logic_enabled:
            hash_search_results = list(map(lambda result: result[0], hash_search_results))
        # Filter out all the Nones to see if we actually found anything
        filtered_results = list(filter(lambda result: bool(result), hash_search_results))
        hash_search_result = filtered_results[0] if filtered_results else None

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


@django_db_all
@pytest.mark.parametrize(
    "in_transition", (True, False), ids=(" in_transition: True ", " in_transition: False ")
)
@pytest.mark.parametrize(
    "new_logic_enabled",
    (True, False),
    ids=(" new_logic_enabled: True ", " new_logic_enabled: False "),
)
def test_new_group(
    new_logic_enabled: bool,
    in_transition: bool,
    default_project: Project,
):
    project = default_project
    event_data = {"message": "testing, testing, 123"}

    results = get_results_from_saving_event(
        event_data=event_data,
        project=project,
        primary_config=NEWSTYLE_CONFIG,
        secondary_config=LEGACY_CONFIG,
        in_transition=in_transition,
        new_logic_enabled=new_logic_enabled,
    )

    if in_transition:
        assert results == {
            "primary_hash_calculated": True,
            "secondary_hash_calculated": True,
            "hashes_different": True,
            "primary_hash_found": False,
            "secondary_hash_found": False,
            "new_group_created": True,
            "primary_grouphash_existed_already": False,
            "secondary_grouphash_existed_already": False,
            "primary_grouphash_exists_now": True,
            "secondary_grouphash_exists_now": True,
            # Moot since no existing group was passed
            "event_assigned_to_given_existing_group": None,
        }
    else:
        assert results == {
            "primary_hash_calculated": True,
            "secondary_hash_calculated": False,
            "primary_hash_found": False,
            "new_group_created": True,
            "primary_grouphash_existed_already": False,
            "primary_grouphash_exists_now": True,
            # The rest are moot since no existing group was passed and no secondary hash was
            # calculated.
            "event_assigned_to_given_existing_group": None,
            "hashes_different": None,
            "secondary_hash_found": None,
            "secondary_grouphash_existed_already": None,
            "secondary_grouphash_exists_now": None,
        }


@django_db_all
@pytest.mark.parametrize(
    "in_transition", (True, False), ids=(" in_transition: True ", " in_transition: False ")
)
@pytest.mark.parametrize(
    "new_logic_enabled",
    (True, False),
    ids=(" new_logic_enabled: True ", " new_logic_enabled: False "),
)
def test_existing_group_no_new_hash(
    new_logic_enabled: bool,
    in_transition: bool,
    default_project: Project,
):
    project = default_project
    event_data = {"message": "testing, testing, 123"}

    # Set the stage by creating a group with the soon-to-be-secondary hash
    existing_event = save_event_with_grouping_config(event_data, project, LEGACY_CONFIG)

    # Now save a new, identical, event with an updated grouping config
    results = get_results_from_saving_event(
        event_data=event_data,
        project=project,
        primary_config=NEWSTYLE_CONFIG,
        secondary_config=LEGACY_CONFIG,
        in_transition=in_transition,
        existing_group_id=existing_event.group_id,
        new_logic_enabled=new_logic_enabled,
    )

    if in_transition:
        assert results == {
            "primary_hash_calculated": True,
            "secondary_hash_calculated": True,
            "hashes_different": True,
            "primary_hash_found": False,
            "secondary_hash_found": True,
            "new_group_created": False,
            "event_assigned_to_given_existing_group": True,
            "primary_grouphash_existed_already": False,
            "secondary_grouphash_existed_already": True,
            "primary_grouphash_exists_now": True,
            "secondary_grouphash_exists_now": True,
        }
    else:
        assert results == {
            "primary_hash_calculated": True,
            "secondary_hash_calculated": False,
            "primary_hash_found": False,
            "new_group_created": True,
            "event_assigned_to_given_existing_group": False,
            "primary_grouphash_existed_already": False,
            "primary_grouphash_exists_now": True,
            # The rest are moot since no secondary hash was calculated.
            "hashes_different": None,
            "secondary_hash_found": None,
            "secondary_grouphash_existed_already": None,
            "secondary_grouphash_exists_now": None,
        }


@django_db_all
@pytest.mark.parametrize(
    "in_transition", (True, False), ids=(" in_transition: True ", " in_transition: False ")
)
@pytest.mark.parametrize(
    "new_logic_enabled",
    (True, False),
    ids=(" new_logic_enabled: True ", " new_logic_enabled: False "),
)
@pytest.mark.parametrize(
    "secondary_hash_exists",
    (True, False),
    ids=(" secondary_hash_exists: True ", " secondary_hash_exists: False "),
)
def test_existing_group_new_hash_exists(
    secondary_hash_exists: bool,
    new_logic_enabled: bool,
    in_transition: bool,
    default_project: Project,
):
    project = default_project
    event_data = {"message": "testing, testing, 123"}

    # Set the stage by creating a group tied to the new hash (and possibly the legacy hash as well)
    if secondary_hash_exists:
        existing_event = save_event_with_grouping_config(
            event_data, project, NEWSTYLE_CONFIG, LEGACY_CONFIG, True
        )
        assert (
            GroupHash.objects.filter(
                project_id=project.id, group_id=existing_event.group_id
            ).count()
            == 2
        )
    else:
        existing_event = save_event_with_grouping_config(event_data, project, NEWSTYLE_CONFIG)
        assert (
            GroupHash.objects.filter(
                project_id=project.id, group_id=existing_event.group_id
            ).count()
            == 1
        )

    # Now save a new, identical, event
    results = get_results_from_saving_event(
        event_data=event_data,
        project=project,
        primary_config=NEWSTYLE_CONFIG,
        secondary_config=LEGACY_CONFIG,
        in_transition=in_transition,
        existing_group_id=existing_event.group_id,
        new_logic_enabled=new_logic_enabled,
    )

    if in_transition and not new_logic_enabled:
        assert results == {
            "primary_hash_calculated": True,
            "secondary_hash_calculated": True,
            "hashes_different": True,
            "primary_hash_found": True,
            "secondary_hash_found": False,  # We found the new hash first and quit looking
            "new_group_created": False,
            "event_assigned_to_given_existing_group": True,
            "primary_grouphash_existed_already": True,
            "secondary_grouphash_existed_already": secondary_hash_exists,
            "primary_grouphash_exists_now": True,
            "secondary_grouphash_exists_now": True,
        }
    # Equivalent to `elif (in_transition and new_logic_enabled) or not in_transition`. In other
    # words, with the new logic, if the new hash exists, it doesn't matter whether we're in
    # transition or not - no extra calculations are performed.
    else:
        assert results == {
            "primary_hash_calculated": True,
            "secondary_hash_calculated": False,
            "primary_hash_found": True,
            "new_group_created": False,
            "event_assigned_to_given_existing_group": True,
            "primary_grouphash_existed_already": True,
            "primary_grouphash_exists_now": True,
            # The rest are moot since no secondary hash was calculated.
            "hashes_different": None,
            "secondary_hash_found": None,
            "secondary_grouphash_existed_already": None,
            "secondary_grouphash_exists_now": None,
        }
