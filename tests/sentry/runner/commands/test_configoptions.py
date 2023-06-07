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
            """
            The isset method returns true even if the option is not set
            in the DB but still present in cache after a call to `get`.
            Till we fix that behavior, we need to clean up the cache
            when we run this test.
            """
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

        # This option will test the drift scenario. We set it to a different
        # value with respect to the file.
        options.set("hybrid_cloud.outbox_rate", 0.5, channel=UpdateChannel.CLI)
        # This tests the scenario were we update the channel. The value
        # is the same we have in the file.
        options.set("backpressure.monitor_queues.enable", True, channel=UpdateChannel.CLI)

        assert_not_set()
        rv = self.invoke(
            "--dry-run",
            "--file=tests/sentry/runner/commands/valid_patch.yaml",
            "patch",
        )
        assert_output(rv)

        assert_not_set()

        rv = self.invoke(
            "--file=tests/sentry/runner/commands/valid_patch.yaml",
            "patch",
        )
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

        # Drifted option
        options.set("hybrid_cloud.outbox_rate", 0.5, channel=UpdateChannel.CLI)
        # This option will be unset as it is not in the file.
        options.set("dynamic-sampling:sliding_window.size", 12, channel=UpdateChannel.AUTOMATOR)

        rv = self.invoke(
            "--file=tests/sentry/runner/commands/valid_patch.yaml",
            "sync",
        )
        assert rv.exit_code == 0, rv.output
        output = "\n".join(
            [
                UPDATE_MSG % "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
                UPDATE_MSG % "dynamic-sampling:boost-latest-release",
                UNSET_MSG % "dynamic-sampling:sliding_window.size",
                DRIFT_MSG % "hybrid_cloud.outbox_rate",
                UPDATE_MSG % "sourcemaps.enable-artifact-bundles",
                CHANNEL_UPDATE_MSG % "backpressure.monitor_queues.enable",
            ]
        )

        assert output in rv.output

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
