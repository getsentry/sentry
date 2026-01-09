#!/usr/bin/env sentry exec
# flake8: noqa: S002
"""
Test script for EAP double-read implementation.

Run with:
  sentry exec scripts/test_eap_double_read.py
  sentry exec scripts/test_eap_double_read.py <GROUP_ID>
"""
import sys
from datetime import timedelta

from django.utils import timezone

from sentry import options
from sentry.api.helpers.events import (
    _reasonable_group_events_match,
    get_events_for_group_eap,
    get_query_builder_for_group,
    run_group_events_query,
)
from sentry.models.group import Group
from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator
from sentry.search.events.types import SnubaParams


def test_double_read(group_id: int | None = None):
    # Find group by ID or get the most recent one
    if group_id:
        group = Group.objects.filter(id=group_id).first()
        if not group:
            print(f"ERROR: Group with ID {group_id} not found.")
            return
    else:
        group = Group.objects.order_by("-last_seen").first()

    if not group:
        # Debug: show what's in the database
        print("ERROR: No groups found in the database.")
        print("\nDebug info:")
        print(f"  Total Group count: {Group.objects.count()}")

        from sentry.models.project import Project

        print(f"  Total Project count: {Project.objects.count()}")

        projects = Project.objects.all()[:5]
        for p in projects:
            print(f"    - Project {p.id}: {p.slug} (org: {p.organization.slug})")

        # Show recent groups if any
        recent_groups = Group.objects.order_by("-last_seen")[:5]
        if recent_groups:
            print("\n  Recent groups:")
            for g in recent_groups:
                print(f"    - Group {g.id}: {g.title[:50]}... (last_seen: {g.last_seen})")

        print("\nMake sure you've ingested an error event through Relay.")
        print("Try: curl -X POST http://localhost:8000/api/{PROJECT_ID}/store/ ...")
        return

    print(f"\n{'='*60}")
    print(f"Testing with Group ID: {group.id}")
    print(f"Project: {group.project.slug}")
    print(f"Organization: {group.project.organization.slug}")
    print(f"{'='*60}\n")

    project = group.project
    snuba_params = SnubaParams(
        start=timezone.now() - timedelta(days=7),
        end=timezone.now(),
        environments=[],
        projects=[project],
        organization=project.organization,
    )

    # Test 1: Snuba query directly
    print("1. Testing Snuba query...")
    try:
        snuba_query = get_query_builder_for_group(
            query="",
            snuba_params=snuba_params,
            group=group,
            limit=10,
            offset=0,
        )
        snuba_result = snuba_query.run_query(referrer="test.snuba")
        snuba_data = snuba_result.get("data", [])
        print(f"   Snuba returned {len(snuba_data)} events")
        snuba_ids = {r["id"] for r in snuba_data}
        print(f"   Event IDs: {list(snuba_ids)[:5]}{'...' if len(snuba_ids) > 5 else ''}")
    except Exception as e:
        print(f"   ERROR: {e}")
        return

    # Test 2: EAP query directly
    print("\n2. Testing EAP query...")
    try:
        eap_data = get_events_for_group_eap(
            query="",
            snuba_params=snuba_params,
            group=group,
            limit=10,
            offset=0,
            orderby=None,
            referrer="test.eap",
        )
        print(f"   EAP returned {len(eap_data)} events")
        eap_ids = {r["id"] for r in eap_data}
        print(f"   Event IDs: {list(eap_ids)[:5]}{'...' if len(eap_ids) > 5 else ''}")
    except Exception as e:
        print(f"   ERROR: {e}")
        eap_data = []
        eap_ids = set()

    # Test 3: Compare results
    print("\n3. Comparing results...")
    print(f"   Snuba count: {len(snuba_data)}")
    print(f"   EAP count: {len(eap_data)}")
    print(f"   EAP is subset of Snuba: {eap_ids.issubset(snuba_ids)}")
    print(f"   Exact match: {snuba_ids == eap_ids}")

    if snuba_ids - eap_ids:
        missing = list(snuba_ids - eap_ids)
        print(f"   Missing from EAP: {missing[:5]}{'...' if len(missing) > 5 else ''}")
    if eap_ids - snuba_ids:
        extra = list(eap_ids - snuba_ids)
        print(f"   Extra in EAP (unexpected!): {extra[:5]}{'...' if len(extra) > 5 else ''}")

    # Test 4: Test the match function
    print("\n4. Testing _reasonable_group_events_match...")
    match_result = _reasonable_group_events_match(snuba_data, eap_data)
    print(f"   Match result: {match_result}")

    # Test 5: Test with experiment enabled
    print("\n5. Testing run_group_events_query with experiment enabled...")
    original_value = options.get(EAPOccurrencesComparator._should_eval_option_name())
    try:
        options.set(EAPOccurrencesComparator._should_eval_option_name(), True)
        print(
            f"   Experiment enabled: {options.get(EAPOccurrencesComparator._should_eval_option_name())}"
        )
        result = run_group_events_query(
            query="",
            snuba_params=snuba_params,
            group=group,
            limit=10,
            offset=0,
            orderby=None,
            referrer="test.double-read",
        )
        print(f"   run_group_events_query returned {len(result)} events")
        print("   (Check logs for 'EAP double-read comparison' for detailed comparison)")
    except Exception as e:
        print(f"   ERROR: {e}")
    finally:
        options.set(EAPOccurrencesComparator._should_eval_option_name(), original_value)
        print(f"   Experiment reset to: {original_value}")

    print(f"\n{'='*60}")
    print("Test complete!")
    print(f"{'='*60}\n")

    # Print curl command for API testing
    print("To test via API, first enable the experiment in Django shell:")
    print("  sentry django shell")
    print("  >>> from sentry import options")
    print("  >>> from sentry.search.eap.occurrences.rollout_utils import EAPOccurrencesComparator")
    print("  >>> options.set(EAPOccurrencesComparator._should_eval_option_name(), True)")
    print()
    print("Then run:")
    print(f"  curl -X GET 'http://localhost:8000/api/0/issues/{group.id}/events/' \\")
    print("    -H 'Authorization: Bearer <YOUR_AUTH_TOKEN>'")
    print()
    print("Watch logs with:")
    print("  tail -f ~/.sentry/sentry.log | grep 'EAP double-read'")
    print()


if __name__ == "__main__":
    # sentry exec passes the script path as an arg, so we need to look for a numeric arg
    group_id = None
    for arg in sys.argv[1:]:
        try:
            group_id = int(arg)
            break
        except ValueError:
            continue
    test_double_read(group_id)
