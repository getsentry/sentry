import hashlib

from sentry.silo.safety import unguarded_write
from sentry.testutils.cases import TestMigrations
from sentry.utils import json


class GeneralizeInvestigationSourcesTest(TestMigrations):
    app = "investigations"
    migrate_from = "0003_remove_investigation_cell_models"
    migrate_to = "0004_generalize_investigation_sources"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Investigation = apps.get_model("investigations", "Investigation")
        with unguarded_write(using="default"):
            self.organization = Organization.objects.create(
                slug="migration-org", name="Migration Organization"
            )
        self.source_ref = {"groupId": "11", "openPeriodId": "22"}
        self.snapshot = {"monitor": {"name": "Checkout errors"}}
        self.legacy_key = hashlib.sha256(b"breached_metric:11:22").hexdigest()
        self.investigation = Investigation.objects.create(
            organization_id=self.organization.id,
            title="Metric breach",
            status="active",
            template_key="breached_metric",
            template_version=1,
            source_type="breached_metric",
            source_ref=self.source_ref,
            source_key=self.legacy_key,
            source_revision=1,
            filters={"breachedMetric": self.snapshot},
        )

    def test_backfills_new_source_fields_without_mutating_legacy_fields(self):
        Investigation = self.apps.get_model("investigations", "Investigation")
        investigation = Investigation.objects.get(id=self.investigation.id)
        expected_source = {
            "type": "metric_open_period",
            "ref": self.source_ref,
            "snapshot": self.snapshot,
        }
        identity = {
            "templateKey": "breached_metric",
            "type": "metric_open_period",
            "ref": self.source_ref,
        }

        assert investigation.source == expected_source
        assert (
            investigation.lineage_key
            == hashlib.sha256(json.dumps(identity, sort_keys=True).encode()).hexdigest()
        )
        assert investigation.source_type == "breached_metric"
        assert investigation.source_ref == self.source_ref
        assert investigation.source_key == self.legacy_key
        assert investigation.filters == {"breachedMetric": self.snapshot}


class ReverseGeneralizeInvestigationSourcesTest(TestMigrations):
    app = "investigations"
    migrate_from = "0004_generalize_investigation_sources"
    migrate_to = "0003_remove_investigation_cell_models"

    def setup_before_migration(self, apps):
        Organization = apps.get_model("sentry", "Organization")
        Investigation = apps.get_model("investigations", "Investigation")
        with unguarded_write(using="default"):
            self.organization = Organization.objects.create(
                slug="reverse-migration-org", name="Reverse Migration Organization"
            )
        self.source_ref = {"groupId": "33", "openPeriodId": "44"}
        self.snapshot = {"monitor": {"name": "Payment errors"}}
        self.legacy_key = hashlib.sha256(b"breached_metric:33:44").hexdigest()
        self.investigation = Investigation.objects.create(
            organization_id=self.organization.id,
            title="Metric breach",
            status="active",
            template_key="breached_metric",
            template_version=1,
            source_type="breached_metric",
            source_ref=self.source_ref,
            source_key=self.legacy_key,
            source={
                "type": "metric_open_period",
                "ref": self.source_ref,
                "snapshot": self.snapshot,
            },
            lineage_key="a" * 64,
            source_revision=1,
            filters={"breachedMetric": self.snapshot},
        )

    def test_reverse_preserves_the_legacy_source_contract(self):
        Investigation = self.apps.get_model("investigations", "Investigation")
        investigation = Investigation.objects.get(id=self.investigation.id)

        assert investigation.source_type == "breached_metric"
        assert investigation.source_ref == self.source_ref
        assert investigation.source_key == self.legacy_key
        assert investigation.source_revision == 1
        assert investigation.filters == {"breachedMetric": self.snapshot}
