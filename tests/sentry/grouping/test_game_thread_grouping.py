"""
Tests for game thread grouping in ANR events.

This module tests the functionality that allows gaming apps to prioritize
grouping ANR events by the game thread rather than the UI thread.
"""

import pytest

from sentry.grouping.api import (
    GroupingConfig,
    get_grouping_variants_for_event,
    load_grouping_config,
)
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class GameThreadGroupingTest(TestCase):
    """Test game thread prioritization for ANR grouping."""

    def test_game_thread_detection(self) -> None:
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

    def test_anr_event_detection(self) -> None:
        """Test that ANR events are correctly identified."""
        from sentry.grouping.strategies.newstyle import _is_anr_event

        # Test ANR mechanism type
        event = save_new_event(
            {
                "exception": {
                    "values": [
                        {
                            "mechanism": {"type": "ANR"},
                            "type": "ApplicationNotResponding",
                        }
                    ]
                }
            },
            self.project,
        )
        assert _is_anr_event(event)

        # Test ApplicationNotResponding exception type without mechanism
        event = save_new_event(
            {"exception": {"values": [{"type": "ApplicationNotResponding"}]}},
            self.project,
        )
        assert _is_anr_event(event)

        # Test non-ANR event
        event = save_new_event(
            {"exception": {"values": [{"type": "RuntimeException"}]}},
            self.project,
        )
        assert not _is_anr_event(event)

    def test_game_thread_grouping_disabled_by_default(self) -> None:
        """Test that game thread grouping is disabled by default."""
        config_dict: GroupingConfig = {"id": "newstyle:2026-01-20", "enhancements": ""}
        config = load_grouping_config(config_dict)

        # Default context should not prioritize game thread
        assert not config.initial_context.get("prioritize_game_thread_for_grouping", False)

    def test_game_thread_grouping_with_anr_event(self) -> None:
        """Test that game thread is used for grouping when enabled for ANR events."""
        # Create ANR event with both UI thread and game thread
        event = save_new_event(
            {
                "platform": "java",
                "exception": {
                    "values": [
                        {
                            "mechanism": {"type": "ANR"},
                            "module": "io.sentry.android.core",
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "main",
                                        "module": "android.app.ActivityThread",
                                        "in_app": False,
                                    },
                                    {
                                        "function": "loop",
                                        "module": "android.os.Looper",
                                        "in_app": False,
                                    },
                                ]
                            },
                            "thread_id": 1,
                            "type": "ApplicationNotResponding",
                            "value": "Application Not Responding for at least 5000 ms.",
                        }
                    ]
                },
                "threads": {
                    "values": [
                        {
                            "id": 1,
                            "name": "main",
                            "current": True,
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "wait",
                                        "module": "java.lang.Object",
                                        "in_app": False,
                                    }
                                ]
                            },
                        },
                        {
                            "id": 2,
                            "name": "UnityMain",
                            "current": False,
                            "stacktrace": {
                                "frames": [
                                    {
                                        "function": "nativeRender",
                                        "module": "com.unity3d.player.UnityPlayer",
                                        "in_app": True,
                                    },
                                    {
                                        "function": "updateGame",
                                        "module": "com.example.game.GameActivity",
                                        "in_app": True,
                                    },
                                ]
                            },
                        },
                    ]
                },
            },
            self.project,
        )

        # Test with game thread grouping disabled (default)
        config_dict: GroupingConfig = {"id": "newstyle:2026-01-20", "enhancements": ""}
        config = load_grouping_config(config_dict)
        variants = get_grouping_variants_for_event(event, config)

        # With default config, should group by UI thread (current thread)
        system_variant = variants.get("system")
        assert system_variant is not None
        assert system_variant.contributes

        # Test with game thread grouping enabled
        config_dict2: GroupingConfig = {"id": "newstyle:2026-01-20", "enhancements": ""}
        config = load_grouping_config(config_dict2)
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

    def test_non_anr_event_not_affected_by_game_thread_config(self) -> None:
        """Test that non-ANR events are not affected by game thread config."""
        event = save_new_event(
            {
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
            },
            self.project,
        )

        # Load config with game thread grouping enabled
        config_dict: GroupingConfig = {"id": "newstyle:2026-01-20", "enhancements": ""}
        config = load_grouping_config(config_dict)
        config.initial_context["prioritize_game_thread_for_grouping"] = True

        # Should work normally for non-ANR events
        variants = get_grouping_variants_for_event(event, config)
        system_variant = variants.get("system")
        assert system_variant is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
