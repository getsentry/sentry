from sentry.models import Group
from sentry.testutils.cases import TestMigrations
from sentry.types.issues import GroupType


class TestBackfill(TestMigrations):
    migrate_from = "0341_reconstrain_savedsearch_pinning_fields"
    migrate_to = "0342_update_perf_issue_groupedmessage_message_field"

    def setup_before_migration(self, apps):
        def _create_group(type, message, data):
            group = Group(
                project_id=self.project.id,
                first_release_id=self.release.id,
                type=type.value,
                message=message,
                data=data,
            )
            group.save()
            return group

        self.error_group = _create_group(
            GroupType.ERROR, "shouldn't change", {"metadata": "don't use this"}
        )
        self.perf_group_malformed_data = _create_group(
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES, "shouldn't change", {}
        )
        self.perf_group_no_metadata = _create_group(
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            "shouldn't change",
            {
                "type": "transaction",
                "culprit": "<location-of-transaction>",
                "title": "<location-of-transaction>",
                "location": "<location-of-transaction>",
                "last_received": 12345567,
            },
        )
        self.perf_group_no_title_in_metadata = _create_group(
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            "shouldn't change",
            {
                "type": "transaction",
                "culprit": "<location-of-transaction>",
                "metadata": {
                    "location": "<location-of-transaction>",
                    "value": "<root cause of the detected issue>",
                },
                "title": "<location-of-transaction>",
                "location": "<location-of-transaction>",
                "last_received": 12345567,
            },
        )
        self.perf_group_message_updated = _create_group(
            GroupType.PERFORMANCE_N_PLUS_ONE_DB_QUERIES,
            "/api/0/unrelated/message/title",
            {
                "type": "transaction",
                "culprit": "<location-of-transaction>",
                "metadata": {
                    "title": "N+1 Query",
                    "location": "<location-of-transaction>",
                    "value": "<root cause of the detected issue>",
                },
                "title": "<location-of-transaction>",
                "location": "<location-of-transaction>",
                "last_received": 12345567,
            },
        )

    def test(self):
        error_group = Group.objects.get(id=self.error_group.id)
        assert error_group.message == "shouldn't change"

        perf_group_malformed_data = Group.objects.get(id=self.perf_group_malformed_data.id)
        assert perf_group_malformed_data.message == "shouldn't change"

        perf_group_no_metadata = Group.objects.get(id=self.perf_group_no_metadata.id)
        assert perf_group_no_metadata.message == "shouldn't change"

        perf_group_no_title_in_metadata = Group.objects.get(
            id=self.perf_group_no_title_in_metadata.id
        )
        assert perf_group_no_title_in_metadata.message == "shouldn't change"

        perf_group_message_updated = Group.objects.get(id=self.perf_group_message_updated.id)
        assert perf_group_message_updated.message == "N+1 Query"
