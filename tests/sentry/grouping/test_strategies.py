from typing import Any

import pytest

from sentry.grouping.strategies.base import GroupingContext, create_strategy_configuration_class
from sentry.services.eventstore.models import Event
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event


class GroupingContextTest(TestCase):

    def _get_new_context(self, initial_context: dict[str, Any] | None = None) -> GroupingContext:
        strategy_class = create_strategy_configuration_class(
            id="doggity_dogs_dogs", initial_context=initial_context
        )
        strategy_instance = strategy_class()
        event = save_new_event({"message": "Dogs are great!"}, self.project)

        return GroupingContext(strategy_instance, event)

    def test_initial_context(self) -> None:
        context = self._get_new_context(initial_context={"adopt": "don't shop"})
        assert context._stack[0] == {"adopt": "don't shop"}

    def test_get_value(self) -> None:
        context = self._get_new_context(initial_context={"adopt": "don't shop"})

        # Behavior when key exists
        assert context["adopt"] == "don't shop"
        assert context.get("adopt") == "don't shop"

        # Behavior when key doesn’t exist
        with pytest.raises(KeyError):
            context["dogs"]
        assert context.get("dogs") is None
        assert context.get("dogs", "great") == "great"

    def test_set_value(self) -> None:
        context = self._get_new_context(initial_context={"adopt": "don't shop"})
        assert context["adopt"] == "don't shop"

        # Change the value, and see that the new value is what's there now
        context["adopt"] = "really don't shop"
        assert context["adopt"] == "really don't shop"

    def test_context_manager(self) -> None:
        """
        Test that:
            - The `GroupingContext` context manager adds a new context layer to the stack when
              entered, and pops it off when the manager exits.
            - Values in lower layers are still accessible even once the new layer has been added.
            - Values in lower layers aren't destroyed when setting values in the top layer.
        """
        context = self._get_new_context(initial_context={"adopt": "don't shop"})
        context["dogs"] = "great"
        context["tricks"] = ["shake", "kangaroo"]

        assert len(context._stack) == 2
        assert context["adopt"] == "don't shop"  # From initial context layer
        assert context["dogs"] == "great"  # Set in layer 1, will be set in layer 2
        assert context["tricks"] == ["shake", "kangaroo"]  # Set in layer 1, won't be set in layer 2

        stack_before_with_context = [*context._stack]

        with context:
            # A new layer has been added
            assert len(context._stack) == 3
            assert context._stack == [*stack_before_with_context, {}]

            # We can set and retrieve values from it, which take precedence over the values which
            # were already there
            context["dogs"] = "yay"
            assert context["dogs"] == "yay"

            # Values from lower levels are still accessible
            assert context["adopt"] == "don't shop"
            assert context["tricks"] == ["shake", "kangaroo"]

        # The new layer is now gone
        assert len(context._stack) == 2
        assert context._stack == stack_before_with_context

        # The old value is now accessible again
        assert context["dogs"] == "great"

        # These have been accessible the whole time and are still accessible
        assert context["adopt"] == "don't shop"
        assert context["tricks"] == ["shake", "kangaroo"]


class StrategyTest(TestCase):
    def test_combines_variants_with_matching_hashes(self) -> None:
        # First, create an event with a mix of in-app and system frames, so that the app and system
        # hashes will be different (since one will be using more frames than the other). We should
        # get one variant for each hash.
        event_data: dict[str, Any] = {
            "exception": {
                "values": [
                    {
                        "type": "FetchError",
                        "value": "Charlie didn't bring the ball back",
                        "stacktrace": {
                            "frames": [
                                {
                                    "function": "play_fetch",
                                    "filename": "dog_games.py",
                                    "in_app": False,
                                },
                                {
                                    "function": "go_to_park",
                                    "filename": "dogpark.py",
                                    "in_app": True,
                                },
                            ]
                        },
                    }
                ]
            },
        }
        non_matching_hash_variants = Event(
            event_id="1121123104150908",
            project_id=self.project.id,
            data=event_data,
        ).get_grouping_variants()

        assert len(non_matching_hash_variants) == 2
        assert list(non_matching_hash_variants.keys()) == ["app", "system"]
        assert (
            non_matching_hash_variants["app"].get_hash()
            != non_matching_hash_variants["system"].get_hash()
        )

        # Now make it so all frames are in-app, which will make the app and system hashes match
        # (since now they'll both be considering the same set of frames). In this case, we should
        # only get one variant, labeled as neither `app` nor `system`.
        event_data["exception"]["values"][0]["stacktrace"]["frames"][0]["in_app"] = True
        matching_hash_variants = Event(
            event_id="1231112109080415",
            project_id=self.project.id,
            data=event_data,
        ).get_grouping_variants()

        assert len(matching_hash_variants) == 1
        assert list(matching_hash_variants.keys()) == ["default"]
        assert (  # These match because they both consider all frames
            matching_hash_variants["default"].get_hash()
            == non_matching_hash_variants["system"].get_hash()
        )


class ChainedExceptionTest(TestCase):
    def test_ignores_mechanism_in_python_sdk_version_3_chained_exception_events(self) -> None:
        # First, get hashes for an event with no `mechanism` data
        event_data: dict[str, Any] = {
            "platform": "python",
            "sdk": {"name": "python", "version": "3.1"},
            "exception": {
                "values": [
                    {"type": "FetchError", "value": "Charlie didn't bring the ball back"},
                    {"type": "ShoeError", "value": "Oh, no! Charlie ate the flip-flops!"},
                    {"type": "AggregateException", "value": "She's a very good dog, but..."},
                ]
            },
        }

        no_mechanism_hashes = Event(
            event_id="1121123104150908",
            project_id=self.project.id,
            data=event_data,
        ).get_hashes()

        # Now add in `mechanism` data, and we'll see that the hash doesn't change
        event_data["exception"]["values"][0]["mechanism"] = {
            "type": "chained",
            "handled": True,
            "source": "InnerExceptions[1]",
            "exception_id": 2,
            "parent_id": 0,
        }
        event_data["exception"]["values"][1]["mechanism"] = {
            "type": "chained",
            "handled": True,
            "source": "InnerExceptions[0]",
            "exception_id": 1,
            "parent_id": 0,
        }
        event_data["exception"]["values"][2]["mechanism"] = {
            "type": "AppDomain.UnhandledException",
            "handled": False,
            "is_exception_group": True,
            "exception_id": 0,
        }

        with_mechanism_hashes = Event(
            event_id="1231112109080415",
            project_id=self.project.id,
            data=event_data,
        ).get_hashes()

        assert no_mechanism_hashes == with_mechanism_hashes

        # Just to prove that were it not for the hack, the grouping *would* change with the addition
        # of mechanism data, we switch the platform
        event_data["platform"] = "javascript"

        js_with_mechanism_hashes = Event(
            event_id="1121201212312012",
            project_id=self.project.id,
            data=event_data,
        ).get_hashes()

        assert js_with_mechanism_hashes != no_mechanism_hashes
