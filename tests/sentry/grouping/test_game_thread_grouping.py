"""
Tests for game thread grouping in ANR events.

This module tests the functionality that allows gaming apps to prioritize
grouping ANR events by the game thread rather than the UI thread.
"""

import pytest

from sentry.grouping.api import get_grouping_variants_for_event, load_grouping_config
from sentry.grouping.strategies.base import GroupingContext
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase


class GameThreadGroupingTest(TestCase):
    """Test game thread prioritization for ANR grouping."""

    def test_game_thread_detection(self):
        """Test that game threads are correctly identified by name patterns."""
        from sentry.grouping.strategies.newstyle import _is_game_thread

        # Test Unity thread names
        assert _is_game_thread({"name": "UnityMain"})
        assert _is_game_thread({"name": "Unity Main Thread"})

        # Test Unreal Engine thread names
        assert _is_game_thread({"name": "GameThread"})
        assert _is_game_thread({"name": "FCocoaGameThread"})
        assert _is_game_thread({"name": "runGameThread"})

        # Test generic game thread names
        assert _is_game_thread({"name": "mainLoop"})
        assert _is_game_thread({"name": "GameLoop"})
        assert _is_game_thread({"name": "game_thread"})

        # Test Cocos2d thread names
        assert _is_game_thread({"name": "Cocos2d"})
        assert _is_game_thread({"name": "CocosThread"})

        # Test render threads
        assert _is_game_thread({"name": "RenderThread"})

        # Test non-game threads
        assert not _is_game_thread({"name": "main"})
        assert not _is_game_thread({"name": "ANR-WatchDog"})
        assert not _is_game_thread({"name": "AsyncTask #1"})
        assert not _is_game_thread({"name": ""})

    def test_anr_event_detection(self):
        """Test that ANR events are correctly identified."""
        from sentry.grouping.strategies.newstyle import _is_anr_event

        # Test ANR mechanism type
        event_data = {
            "exception": {
                "values": [
                    {
                        "mechanism": {"type": "ANR"},
                        "type": "ApplicationNotResponding",
                    }
                ]
            }
        }
        event = Event(event_id="test", data=event_data)
        assert _is_anr_event(event)

        # Test ApplicationNotResponding exception type without mechanism
        event_data = {"exception": {"values": [{"type": "ApplicationNotResponding"}]}}
        event = Event(event_id="test", data=event_data)
        assert _is_anr_event(event)

        # Test non-ANR event
        event_data = {"exception": {"values": [{"type": "RuntimeException"}]}}
        event = Event(event_id="test", data=event_data)
        assert not _is_anr_event(event)

        # Test event with no exceptions
        event_data = {}
        event = Event(event_id="test", data=event_data)
        assert not _is_anr_event(event)

    def test_game_thread_grouping_disabled_by_default(self):
        """Test that game thread grouping is disabled by default."""
        config = load_grouping_config({"id": "newstyle:2026-01-20", "enhancements": ""})
        context = GroupingContext(config)

        # Default behavior should not prioritize game thread
        assert not context.get("prioritize_game_thread_for_grouping", False)

    def test_game_thread_grouping_with_anr_event(self):
        """Test that game thread is used for grouping when enabled for ANR events."""
        import json
        from pathlib import Path

        # Load the test ANR event with game thread
        test_file = Path(__file__).parent / "grouping_inputs" / "android-anr-game-thread.json"
        with open(test_file) as f:
            event_data = json.load(f)

        event = Event(event_id="test", data=event_data, project_id=1)

        # Test with game thread grouping disabled (default)
        config = load_grouping_config({"id": "newstyle:2026-01-20", "enhancements": ""})
        variants = get_grouping_variants_for_event(event, config)

        # With default config, should group by UI thread (current thread)
        system_variant = variants.get("system")
        assert system_variant is not None
        assert system_variant.contributes

        # Test with game thread grouping enabled
        config_dict = {"id": "newstyle:2026-01-20", "enhancements": ""}
        config = load_grouping_config(config_dict)
        # Manually enable game thread prioritization in the context
        config.initial_context["prioritize_game_thread_for_grouping"] = True

        variants_with_game_thread = get_grouping_variants_for_event(event, config)

        # With game thread enabled, should use game thread for grouping
        system_variant_game = variants_with_game_thread.get("system")
        assert system_variant_game is not None
        assert system_variant_game.contributes

        # The hashes should be different when using different threads
        # (game thread vs UI thread)
        default_hash = system_variant.get_hash()
        game_thread_hash = system_variant_game.get_hash()

        # These should be different because they're grouping by different threads
        assert default_hash != game_thread_hash

    def test_non_anr_event_not_affected_by_game_thread_config(self):
        """Test that non-ANR events are not affected by game thread config."""
        event_data = {
            "exception": {
                "values": [
                    {
                        "type": "RuntimeException",
                        "value": "Test exception",
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "testMethod",
                                    "module": "com.example.Test",
                                    "in_app": True,
                                }
                            ]
                        },
                    }
                ]
            }
        }
        event = Event(event_id="test", data=event_data, project_id=1)

        # Load config with game thread grouping enabled
        config_dict = {"id": "newstyle:2026-01-20", "enhancements": ""}
        config = load_grouping_config(config_dict)
        config.initial_context["prioritize_game_thread_for_grouping"] = True

        # Should work normally for non-ANR events
        variants = get_grouping_variants_for_event(event, config)
        system_variant = variants.get("system")
        assert system_variant is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
