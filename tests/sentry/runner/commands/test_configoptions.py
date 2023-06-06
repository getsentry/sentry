from sentry import options
from sentry.options.manager import UpdateChannel
from sentry.runner.commands.configoptions import (
    CHANNEL_UPDATE_MSG,
    DRIFT_MSG,
    UNSET_MSG,
    UPDATE_MSG,
    configoptions,
)
from sentry.testutils import CliTestCase


class ConfigOptionsTest(CliTestCase):
    command = configoptions

    def test_patch(self):
        def clean_cache() -> None:
            options.default_store.flush_local_cache()

            options.default_store.delete_cache(
                options.lookup_key("sourcemaps.enable-artifact-bundles")
            )
            options.default_store.delete_cache(
                options.lookup_key("dynamic-sampling:boost-latest-release")
            )
            options.default_store.delete_cache(
                options.lookup_key(
                    "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org"
                )
            )
            options.default_store.delete_cache(
                options.lookup_key("backpressure.monitor_queues.enable")
            )

        def assert_not_set() -> None:
            clean_cache()
            assert not options.isset("sourcemaps.enable-artifact-bundles")
            assert not options.isset("dynamic-sampling:boost-latest-release")
            assert not options.isset(
                "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org"
            )

        def assert_output(rv):
            assert rv.exit_code == 0, rv.output
            output = "\n".join(
                [
                    DRIFT_MSG % "hybrid_cloud.outbox_rate",
                    UPDATE_MSG % "sourcemaps.enable-artifact-bundles",
                    UPDATE_MSG % "dynamic-sampling:boost-latest-release",
                    UPDATE_MSG % "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
                    CHANNEL_UPDATE_MSG % "backpressure.monitor_queues.enable",
                ]
            )
            assert output in rv.output

        options.set("hybrid_cloud.outbox_rate", 0.5, channel=UpdateChannel.CLI)
        options.set("backpressure.monitor_queues.enable", True, channel=UpdateChannel.CLI)

        assert_not_set()
        rv = self.invoke("patch", "--dry-run", "tests/sentry/runner/commands/valid_patch.yaml")
        assert_output(rv)

        assert_not_set()

        rv = self.invoke("patch", "tests/sentry/runner/commands/valid_patch.yaml")
        assert_output(rv)

        clean_cache()
        assert options.isset("sourcemaps.enable-artifact-bundles")
        assert options.get("sourcemaps.enable-artifact-bundles") == 0.1
        assert options.isset("dynamic-sampling:boost-latest-release")
        assert options.get("dynamic-sampling:boost-latest-release") is True
        assert options.isset("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org")
        assert options.get("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org") == [
            "a",
            "b",
        ]
        assert options.get("hybrid_cloud.outbox_rate") == 0.5
        assert options.get("backpressure.monitor_queues.enable") is True

    def test_sync(self):
        options.delete("sourcemaps.enable-artifact-bundles")
        options.delete("dynamic-sampling:boost-latest-release")
        options.delete("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org")

        options.set("hybrid_cloud.outbox_rate", 0.5, channel=UpdateChannel.CLI)
        options.set("dynamic-sampling:sliding_window.size", 12, channel=UpdateChannel.AUTOMATOR)

        rv = self.invoke("sync", "tests/sentry/runner/commands/valid_patch.yaml")
        assert rv.exit_code == 0, rv.output
        assert UPDATE_MSG % "sourcemaps.enable-artifact-bundles" in rv.output
        assert UPDATE_MSG % "dynamic-sampling:boost-latest-release" in rv.output
        assert (
            UPDATE_MSG % "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org"
            in rv.output
        )
        assert DRIFT_MSG % "hybrid_cloud.outbox_rate" in rv.output
        assert UNSET_MSG % "dynamic-sampling:sliding_window.size" in rv.output

        assert options.get("sourcemaps.enable-artifact-bundles") == 0.1
        assert options.get("dynamic-sampling:boost-latest-release") is True
        assert options.get("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org") == [
            "a",
            "b",
        ]
        assert options.get("hybrid_cloud.outbox_rate") == 0.5

        assert not options.isset("dynamic-sampling:sliding_window.size")

    def test_bad_patch(self):
        rv = self.invoke("patch", "tests/sentry/runner/commands/badpatch.yaml")
        assert rv.exit_code != 0, rv.output
