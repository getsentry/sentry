from __future__ import annotations

from contextlib import contextmanager
from time import time
from typing import Any
from unittest import mock

import pytest

from sentry.event_manager import _create_group
from sentry.eventstore.models import Event
from sentry.grouping.ingest.hashing import (
    _calculate_primary_hashes_and_variants,
    _calculate_secondary_hashes,
    find_grouphash_with_group,
)
from sentry.grouping.ingest.metrics import record_hash_calculation_metrics
from sentry.models.grouphash import GroupHash
from sentry.models.project import Project
from sentry.projectoptions.defaults import DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.pytest.fixtures import django_db_all
from sentry.testutils.pytest.mocking import capture_results
from sentry.testutils.skips import requires_snuba

pytestmark = [requires_snuba]


@contextmanager
def patch_grouping_helpers(return_values: dict[str, Any]):
    wrapped_find_grouphash_with_group = capture_results(find_grouphash_with_group, return_values)
    wrapped_calculate_primary_hashes = capture_results(
        _calculate_primary_hashes_and_variants, return_values
    )
    wrapped_calculate_secondary_hashes = capture_results(_calculate_secondary_hashes, return_values)

    with (
        mock.patch(
            "sentry.event_manager.find_grouphash_with_group",
            wraps=wrapped_find_grouphash_with_group,
        ) as find_grouphash_with_group_spy,
        mock.patch(
            "sentry.grouping.ingest.hashing._calculate_primary_hashes_and_variants",
            wraps=wrapped_calculate_primary_hashes,
        ) as calculate_primary_hashes_spy,
        mock.patch(
            "sentry.grouping.ingest.hashing._calculate_secondary_hashes",
            wraps=wrapped_calculate_secondary_hashes,
        ) as calculate_secondary_hashes_spy,
        mock.patch(
            "sentry.event_manager._create_group",
            # No return-value-wrapping necessary here, since all we need
            # is the group id, and that's stored on the event
            wraps=_create_group,
        ) as create_group_spy,
        mock.patch(
            "sentry.event_manager.record_hash_calculation_metrics",
            # No return-value-wrapping necessary here either, since it doesn't return anything
            wraps=record_hash_calculation_metrics,
        ) as record_calculation_metrics_spy,
    ):
        yield {
            "find_grouphash_with_group": find_grouphash_with_group_spy,
            "_calculate_primary_hashes_and_variants": calculate_primary_hashes_spy,
            "_calculate_secondary_hashes": calculate_secondary_hashes_spy,
            "_create_group": create_group_spy,
            "record_calculation_metrics": record_calculation_metrics_spy,
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
        calculate_secondary_hash_spy = spies["_calculate_secondary_hashes"]
        create_group_spy = spies["_create_group"]
        calculate_primary_hash_spy = spies["_calculate_primary_hashes_and_variants"]
        record_calculation_metrics_spy = spies["record_calculation_metrics"]

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

        hash_search_results = return_values["find_grouphash_with_group"]
        # Filter out all the Nones to see if we actually found anything
        filtered_results = list(filter(lambda result: bool(result), hash_search_results))
        hash_search_result = filtered_results[0] if filtered_results else None

        # We should never call any of these more than once, regardless of the test
        assert calculate_primary_hash_spy.call_count <= 1
        assert calculate_secondary_hash_spy.call_count <= 1
        assert create_group_spy.call_count <= 1

        primary_hash_calculated = calculate_primary_hash_spy.call_count == 1
        secondary_hash_calculated = calculate_secondary_hash_spy.call_count == 1

        primary_hash = return_values["_calculate_primary_hashes_and_variants"][0][0][0]
        primary_hash_found = (
            hash_search_result is not None and hash_search_result.hash == primary_hash
        )

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
                (new_event.group_id == existing_group_id) if existing_group_id else None
            )

        if secondary_hash_calculated:
            secondary_hash = return_values["_calculate_secondary_hashes"][0][0]
            hashes_different = secondary_hash != primary_hash
            secondary_hash_found = (
                hash_search_result is not None and hash_search_result.hash == secondary_hash
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

        result_tag_value_for_metrics = record_calculation_metrics_spy.call_args.args[5]

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
            "result_tag_value_for_metrics": result_tag_value_for_metrics,
        }


# The overall idea of these tests is to prove that
#
#   a) We only run the secondary calculation when the project is in transtiion
#   b) In transition, we only run the secondary calculation if the primary calculation
#      doesn't find an existing group
#   c) If the primary (or secondary, if it's calculated) hash finds a group, the event is
#      assigned there
#   d) If neither finds a group, a new group is created and the primary hash is stored (but
#      the secondary hash is not, even if it's calculated)


@django_db_all
@pytest.mark.parametrize(
    "in_transition", (True, False), ids=(" in_transition: True ", " in_transition: False ")
)
def test_new_group(
    in_transition: bool,
    default_project: Project,
):
    project = default_project
    event_data = {"message": "testing, testing, 123"}

    results = get_results_from_saving_event(
        event_data=event_data,
        project=project,
        primary_config=DEFAULT_GROUPING_CONFIG,
        secondary_config=LEGACY_GROUPING_CONFIG,
        in_transition=in_transition,
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
            "secondary_grouphash_exists_now": False,
            "result_tag_value_for_metrics": "no_match",
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
            "result_tag_value_for_metrics": "no_match",
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
def test_existing_group_no_new_hash(
    in_transition: bool,
    default_project: Project,
):
    project = default_project
    event_data = {"message": "testing, testing, 123"}

    # Set the stage by creating a group with the soon-to-be-secondary hash
    existing_event = save_event_with_grouping_config(event_data, project, LEGACY_GROUPING_CONFIG)

    # Now save a new, identical, event with an updated grouping config
    results = get_results_from_saving_event(
        event_data=event_data,
        project=project,
        primary_config=DEFAULT_GROUPING_CONFIG,
        secondary_config=LEGACY_GROUPING_CONFIG,
        in_transition=in_transition,
        existing_group_id=existing_event.group_id,
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
            "result_tag_value_for_metrics": "found_secondary",
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
            "result_tag_value_for_metrics": "no_match",
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
    "secondary_hash_exists",
    (True, False),
    ids=(" secondary_hash_exists: True ", " secondary_hash_exists: False "),
)
def test_existing_group_new_hash_exists(
    secondary_hash_exists: bool,
    in_transition: bool,
    default_project: Project,
):
    project = default_project
    event_data = {"message": "testing, testing, 123"}

    # Set the stage by creating a group tied to the new hash (and possibly the legacy hash as well)
    if secondary_hash_exists:
        existing_event_with_secondary_hash = save_event_with_grouping_config(
            event_data, project, LEGACY_GROUPING_CONFIG
        )
        existing_event_with_primary_hash = save_event_with_grouping_config(
            event_data, project, DEFAULT_GROUPING_CONFIG, LEGACY_GROUPING_CONFIG, True
        )
        group_id = existing_event_with_primary_hash.group_id

        assert (
            existing_event_with_secondary_hash.group_id == existing_event_with_primary_hash.group_id
        )
        assert group_id is not None
        assert GroupHash.objects.filter(project_id=project.id, group_id=group_id).count() == 2
    else:
        existing_event_with_primary_hash = save_event_with_grouping_config(
            event_data, project, DEFAULT_GROUPING_CONFIG
        )
        group_id = existing_event_with_primary_hash.group_id

        assert group_id is not None
        assert GroupHash.objects.filter(project_id=project.id, group_id=group_id).count() == 1

    # Now save a new, identical, event
    results = get_results_from_saving_event(
        event_data=event_data,
        project=project,
        primary_config=DEFAULT_GROUPING_CONFIG,
        secondary_config=LEGACY_GROUPING_CONFIG,
        in_transition=in_transition,
        existing_group_id=group_id,
    )

    assert results == {
        "primary_hash_calculated": True,
        "secondary_hash_calculated": False,
        "primary_hash_found": True,
        "new_group_created": False,
        "event_assigned_to_given_existing_group": True,
        "primary_grouphash_existed_already": True,
        "primary_grouphash_exists_now": True,
        "result_tag_value_for_metrics": "found_primary",
        # The rest are moot since no secondary hash was calculated.
        "hashes_different": None,
        "secondary_hash_found": None,
        "secondary_grouphash_existed_already": None,
        "secondary_grouphash_exists_now": None,
    }
