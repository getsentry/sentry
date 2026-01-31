#!/usr/bin/env python
"""
Test script for Seer Explorer Client integration.

Run this from the Sentry Django shell:
    sentry django shell < scripts/test_seer_explorer.py

Or import and run manually:
    from scripts.test_seer_explorer import test_seer_connection, test_explorer_client
    test_seer_connection()
    test_explorer_client()
"""

import requests
from django.conf import settings


def test_seer_connection():
    """Test basic connectivity to Seer."""
    print("=" * 50)
    print("Testing Seer Connection")
    print("=" * 50)

    seer_url = getattr(settings, 'SEER_AUTOFIX_URL', 'http://127.0.0.1:9091')
    print(f"Seer URL: {seer_url}")

    # Test health endpoints
    endpoints = [
        "/health/live",
        "/health/ready",
    ]

    for endpoint in endpoints:
        try:
            resp = requests.get(f"{seer_url}{endpoint}", timeout=5)
            print(f"  {endpoint}: {resp.status_code} - {resp.text.strip()}")
        except Exception as e:
            print(f"  {endpoint}: FAILED - {e}")

    print()
    return True


def test_explorer_client():
    """Test the Seer Explorer Client."""
    print("=" * 50)
    print("Testing Seer Explorer Client")
    print("=" * 50)

    from pydantic import BaseModel
    from sentry.models.organization import Organization
    from sentry.users.models.user import User
    from sentry.seer.explorer.client import SeerExplorerClient

    # Get first org and user for testing
    try:
        org = Organization.objects.first()
        user = User.objects.first()

        if not org:
            print("ERROR: No organization found. Run 'bin/load-mocks' first.")
            return False

        if not user:
            print("ERROR: No user found.")
            return False

        print(f"Organization: {org.slug} (id={org.id})")
        print(f"User: {user.email} (id={user.id})")
        print()

        # Create client
        client = SeerExplorerClient(org, user)
        print("SeerExplorerClient created successfully!")
        print()

        # Test a simple run (this will actually call Seer)
        print("Starting a test run...")
        print("Prompt: 'What is 2 + 2? Just answer with the number.'")
        print()

        try:
            run_id = client.start_run(
                "What is 2 + 2? Just answer with the number.",
                category_key="test",
                category_value="seer-integration-test"
            )
            print(f"Run started! run_id={run_id}")

            # Poll for result (with timeout)
            print("Waiting for result (max 30 seconds)...")
            state = client.get_run(run_id, blocking=True, timeout=30)

            print(f"Run status: {state.status}")
            if state.messages:
                last_msg = state.messages[-1]
                print(f"Last message: {last_msg.get('content', 'N/A')[:200]}...")

            print()
            print("SUCCESS! Seer Explorer Client is working!")
            return True

        except Exception as e:
            print(f"ERROR during run: {e}")
            import traceback
            traceback.print_exc()
            return False

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_simple_assertion_suggestion():
    """
    Test what we'd do for NEW-699: generate assertion suggestions from HTTP response.
    """
    print("=" * 50)
    print("Testing Assertion Suggestion (NEW-699 prototype)")
    print("=" * 50)

    from pydantic import BaseModel
    from sentry.models.organization import Organization
    from sentry.users.models.user import User
    from sentry.seer.explorer.client import SeerExplorerClient

    # Define the artifact schema for assertions
    class SuggestedAssertion(BaseModel):
        assertion_type: str  # e.g., "status_code", "response_time", "body_contains"
        operator: str        # e.g., "equals", "less_than", "contains"
        value: str
        confidence: float
        explanation: str

    class AssertionSuggestions(BaseModel):
        suggestions: list[SuggestedAssertion]

    # Mock HTTP response data
    mock_response = {
        "status_code": 200,
        "response_time_ms": 145,
        "headers": {
            "content-type": "application/json",
            "x-request-id": "abc123"
        },
        "body": {
            "status": "healthy",
            "version": "1.2.3",
            "uptime": 99.9
        }
    }

    try:
        org = Organization.objects.first()
        user = User.objects.first()

        if not org or not user:
            print("ERROR: No org/user found.")
            return False

        client = SeerExplorerClient(org, user)

        prompt = f"""Analyze this HTTP response from an uptime monitor test and suggest assertions
that would be useful for monitoring this endpoint. For each suggestion, provide:
- assertion_type: what aspect to check (status_code, response_time, body_contains, header_exists, etc.)
- operator: the comparison (equals, less_than, greater_than, contains, exists, etc.)
- value: the expected value as a string
- confidence: how confident you are this is a good assertion (0.0-1.0)
- explanation: why this assertion is useful

HTTP Response:
{mock_response}

Suggest 3-5 practical assertions."""

        print(f"Testing with mock response: {mock_response}")
        print()

        run_id = client.start_run(
            prompt,
            artifact_key="assertions",
            artifact_schema=AssertionSuggestions,
            category_key="uptime",
            category_value="assertion-suggestions"
        )

        print(f"Run started: {run_id}")
        state = client.get_run(run_id, blocking=True, timeout=60)

        print(f"Status: {state.status}")

        # Try to get the artifact
        suggestions = state.get_artifact("assertions", AssertionSuggestions)
        if suggestions:
            print(f"\nGenerated {len(suggestions.suggestions)} assertion suggestions:")
            for i, s in enumerate(suggestions.suggestions, 1):
                print(f"\n{i}. {s.assertion_type} {s.operator} '{s.value}'")
                print(f"   Confidence: {s.confidence}")
                print(f"   Reason: {s.explanation}")
        else:
            print("No artifact returned. Check messages:")
            if state.messages:
                print(state.messages[-1].get('content', 'N/A')[:500])

        return True

    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    # Run tests
    test_seer_connection()
    test_explorer_client()
