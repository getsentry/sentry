from functools import cached_property

import pytest
from django.core.cache.backends.locmem import LocMemCache

from sentry.options.manager import FLAG_AUTOMATOR_MODIFIABLE, OptionsManager, UpdateChannel
from sentry.options.store import OptionsStore
from sentry.runner.commands.configoptions import configoptions
from sentry.testutils import CliTestCase


class ConfigOptionsTest(CliTestCase):
    command = configoptions

    @cached_property
    def store(self):
        c = LocMemCache("test", {})
        c.clear()
        return OptionsStore(cache=c)

    @cached_property
    def manager(self):
        return OptionsManager(store=self.store)

    @pytest.fixture(autouse=True)
    def register(self):
        self.store.flush_local_cache()
        self.manager.register(
            "hybrid_cloud.outbox_rate", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
        )
        self.manager.register(
            "sourcemaps.enable-artifact-bundles", default=0.0, flags=FLAG_AUTOMATOR_MODIFIABLE
        )
        self.manager.register(
            "dynamic-sampling:boost-latest-release", default=False, flags=FLAG_AUTOMATOR_MODIFIABLE
        )
        self.manager.register(
            "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org",
            default=[],
            flags=FLAG_AUTOMATOR_MODIFIABLE,
        )
        self.manager.register(
            "dynamic-sampling:sliding_window.size", default=24, flags=FLAG_AUTOMATOR_MODIFIABLE
        )

    def test_sync(self):
        self.manager.delete("hybrid_cloud.outbox_rate")
        self.manager.delete("sourcemaps.enable-artifact-bundles")
        self.manager.delete("dynamic-sampling:boost-latest-release")
        self.manager.delete("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org")
        self.manager.delete("dynamic-sampling:sliding_window.size")

        self.manager.set("hybrid_cloud.outbox_rate", 0.5, channel=UpdateChannel.CLI)
        self.manager.set(
            "dynamic-sampling:sliding_window.size", 12, channel=UpdateChannel.AUTOMATOR
        )

        rv = self.invoke("sync", "tests/sentry/runner/commands/valid_patch.yaml")
        assert rv.exit_code == 0, rv.output
        assert "Option: sourcemaps.enable-artifact-bundles updated" in rv.output
        assert "Option: dynamic-sampling:boost-latest-release updated" in rv.output
        assert (
            "Option: sentry-metrics.cardinality-limiter.limits.releasehealth.per-org updated"
            in rv.output
        )
        assert "Option hybrid_cloud.outbox_rate cannot be updated. Reason: drifted" in rv.output
        assert "Option dynamic-sampling:sliding_window.size unset" in rv.output

        assert self.manager.isset("sourcemaps.enable-artifact-bundles")
        assert self.manager.get("sourcemaps.enable-artifact-bundles") == 0.1
        assert self.manager.isset("dynamic-sampling:boost-latest-release")
        assert self.manager.get("dynamic-sampling:boost-latest-release") is True
        assert self.manager.isset("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org")
        assert self.manager.get(
            "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org"
        ) == ["a", "b"]
        assert self.manager.get("hybrid_cloud.outbox_rate") == 0.5

        assert not self.manager.isset("dynamic-sampling:sliding_window.size")

    def test_patch(self):
        def assert_not_set() -> None:
            assert not self.manager.isset("sourcemaps.enable-artifact-bundles")
            assert not self.manager.isset("dynamic-sampling:boost-latest-release")
            assert not self.manager.isset(
                "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org"
            )

        def assert_output(rv):
            assert rv.exit_code == 0, rv.output
            assert "Option: sourcemaps.enable-artifact-bundles updated" in rv.output
            assert "Option: dynamic-sampling:boost-latest-release updated" in rv.output
            assert (
                "Option: sentry-metrics.cardinality-limiter.limits.releasehealth.per-org updated"
                in rv.output
            )
            assert "Option hybrid_cloud.outbox_rate cannot be updated. Reason: drifted" in rv.output

        self.manager.set("hybrid_cloud.outbox_rate", 0.5, channel=UpdateChannel.CLI)

        assert_not_set()
        rv = self.invoke("patch", "--dryrun", "tests/sentry/runner/commands/valid_patch.yaml")
        assert_output(rv)

        assert_not_set()

        rv = self.invoke("patch", "tests/sentry/runner/commands/valid_patch.yaml")
        assert_output(rv)

        assert self.manager.isset("sourcemaps.enable-artifact-bundles")
        assert self.manager.get("sourcemaps.enable-artifact-bundles") == 0.1
        assert self.manager.isset("dynamic-sampling:boost-latest-release")
        assert self.manager.get("dynamic-sampling:boost-latest-release") is True
        assert self.manager.isset("sentry-metrics.cardinality-limiter.limits.releasehealth.per-org")
        assert self.manager.get(
            "sentry-metrics.cardinality-limiter.limits.releasehealth.per-org"
        ) == ["a", "b"]
        assert self.manager.get("hybrid_cloud.outbox_rate") == 0.5

    def test_bad_patch(self):
        rv = self.invoke("patch", "tests/sentry/runner/commands/badpatch.yaml")
        assert rv.exit_code != 0, rv.output
