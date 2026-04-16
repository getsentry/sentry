from __future__ import annotations

from unittest.mock import MagicMock, patch

from sentry import audit_log
from sentry.conf.server import DEFAULT_GROUPING_CONFIG, SENTRY_GROUPING_CONFIG_TRANSITION_DURATION
from sentry.grouping.api import get_grouping_config_dict_for_project
from sentry.grouping.ingest.config import update_or_set_grouping_config_if_needed
from sentry.models.auditlogentry import AuditLogEntry
from sentry.models.options.project_option import ProjectOption
from sentry.testutils.cases import TestCase
from sentry.testutils.helpers.eventprocessing import save_new_event
from sentry.testutils.helpers.options import override_options
from sentry.testutils.silo import assume_test_silo_mode_of
from tests.sentry.grouping import NO_MSG_PARAM_CONFIG


class GroupingConfigTest(TestCase):
    def test_loads_default_config_if_stored_config_option_is_invalid(self) -> None:
        self.project.update_option("sentry:grouping_config", "dogs.are.great")
        config_dict = get_grouping_config_dict_for_project(self.project)
        assert config_dict["id"] == DEFAULT_GROUPING_CONFIG

        self.project.update_option("sentry:grouping_config", {"not": "a string"})
        config_dict = get_grouping_config_dict_for_project(self.project)
        assert config_dict["id"] == DEFAULT_GROUPING_CONFIG

    def test_updates_grouping_config_if_current_config_is_not_default(self) -> None:
        self.project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)
        # Setting the project's platform prevents it from being set automatically, which in turn
        # means the grouping config update will be the only `PROJECT_EDIT` audit log entry
        self.project.update(platform="python")

        save_new_event({"message": "Adopt don't shop"}, self.project)
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG

        with assume_test_silo_mode_of(AuditLogEntry):
            audit_log_entry = AuditLogEntry.objects.filter(
                event=audit_log.get_event_id("PROJECT_EDIT")
            ).first()

        assert audit_log_entry is not None
        assert audit_log_entry.actor_label == "Sentry"
        assert audit_log_entry.data["sentry:grouping_config"] == DEFAULT_GROUPING_CONFIG
        assert audit_log_entry.data["sentry:secondary_grouping_config"] == NO_MSG_PARAM_CONFIG

        expected_expiry = (
            int(audit_log_entry.datetime.timestamp()) + SENTRY_GROUPING_CONFIG_TRANSITION_DURATION
        )
        # When the config upgrade is actually happening, the expiry value is set before the
        # audit log entry is created, which means the expiry is based on a timestamp
        # ever-so-slightly before the audit log entry's timestamp, making a one-second tolerance
        # necessary.
        assert expected_expiry - audit_log_entry.data["sentry:secondary_grouping_expiry"] < 1

    def test_updates_grouping_config_if_current_config_is_invalid(self) -> None:
        self.project.update_option("sentry:grouping_config", "non_existent_config")
        save_new_event({"message": "dogs are great"}, self.project)

        # The config has been updated, but no transition has started because we can't calculate
        # a secondary hash using a config that doesn't exist
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None
        assert self.project.get_option("sentry:secondary_grouping_expiry") == 0

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_sets_grouping_config_if_project_option_is_missing(
        self, update_config_spy: MagicMock
    ) -> None:
        # To start, the project defaults to the current config but doesn't have its own config
        # option set in the DB
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert (
            ProjectOption.objects.filter(
                project_id=self.project.id, key="sentry:grouping_config"
            ).first()
            is None
        )

        save_new_event({"message": "Dogs are great!"}, self.project)

        update_config_spy.assert_called_with(self.project, "ingest")

        # After the function has been called, the config still defaults to the current one (and no
        # transition has started), but the project now has its own config record in the DB
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None
        assert self.project.get_option("sentry:secondary_grouping_expiry") == 0
        assert ProjectOption.objects.filter(
            project_id=self.project.id, key="sentry:grouping_config"
        ).exists()

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_update_no_ops_if_grouping_config_project_option_exists_and_is_current(
        self, update_config_spy: MagicMock
    ) -> None:
        self.project.update_option("sentry:grouping_config", DEFAULT_GROUPING_CONFIG)

        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert ProjectOption.objects.filter(
            project_id=self.project.id, key="sentry:grouping_config"
        ).exists()

        save_new_event({"message": "Dogs are great!"}, self.project)

        update_config_spy.assert_called_with(self.project, "ingest")

        # After the function has been called, the config still defaults to the current one and no
        # transition has started
        assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
        assert self.project.get_option("sentry:secondary_grouping_config") is None
        assert self.project.get_option("sentry:secondary_grouping_expiry") == 0

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_update_no_ops_if_sample_rate_test_fails(self, update_config_spy: MagicMock) -> None:
        with (
            # Ensure our die roll will fall outside the sample rate
            patch("sentry.grouping.ingest.config.random", return_value=0.1121),
            override_options({"grouping.config_transition.config_upgrade_sample_rate": 0.0908}),
        ):
            self.project.update_option("sentry:grouping_config", NO_MSG_PARAM_CONFIG)
            assert self.project.get_option("sentry:grouping_config") == NO_MSG_PARAM_CONFIG

            save_new_event({"message": "Dogs are great!"}, self.project)

            update_config_spy.assert_called_with(self.project, "ingest")

            # After the function has been called, the config hasn't changed and no transition has
            # started
            assert self.project.get_option("sentry:grouping_config") == NO_MSG_PARAM_CONFIG
            assert self.project.get_option("sentry:secondary_grouping_config") is None
            assert self.project.get_option("sentry:secondary_grouping_expiry") == 0

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_update_ignores_sample_rate_if_current_config_is_invalid(
        self, update_config_spy: MagicMock
    ) -> None:
        with (
            # Ensure our die roll will fall outside the sample rate
            patch("sentry.grouping.ingest.config.random", return_value=0.1121),
            override_options({"grouping.config_transition.config_upgrade_sample_rate": 0.0908}),
        ):
            self.project.update_option("sentry:grouping_config", "not_a_real_config")
            assert self.project.get_option("sentry:grouping_config") == "not_a_real_config"

            save_new_event({"message": "Dogs are great!"}, self.project)

            update_config_spy.assert_called_with(self.project, "ingest")

            # The config has been updated, but no transition has started because we can't calculate
            # a secondary hash using a config that doesn't exist
            assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
            assert self.project.get_option("sentry:secondary_grouping_config") is None
            assert self.project.get_option("sentry:secondary_grouping_expiry") == 0

    @patch(
        "sentry.event_manager.update_or_set_grouping_config_if_needed",
        wraps=update_or_set_grouping_config_if_needed,
    )
    def test_update_ignores_sample_rate_if_no_record_exists(
        self, update_config_spy: MagicMock
    ) -> None:
        with (
            # Ensure our die roll will fall outside the sample rate
            patch("sentry.grouping.ingest.config.random", return_value=0.1121),
            override_options({"grouping.config_transition.config_upgrade_sample_rate": 0.0908}),
        ):
            assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
            assert not ProjectOption.objects.filter(
                project_id=self.project.id, key="sentry:grouping_config"
            ).exists()

            save_new_event({"message": "Dogs are great!"}, self.project)

            update_config_spy.assert_called_with(self.project, "ingest")

            # The config hasn't been updated, but now the project has its own record. No transition
            # has started because the config was already up to date.
            assert self.project.get_option("sentry:grouping_config") == DEFAULT_GROUPING_CONFIG
            assert ProjectOption.objects.filter(
                project_id=self.project.id, key="sentry:grouping_config"
            ).exists()
            assert self.project.get_option("sentry:secondary_grouping_config") is None
            assert self.project.get_option("sentry:secondary_grouping_expiry") == 0
