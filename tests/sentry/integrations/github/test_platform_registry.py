from __future__ import annotations

from sentry.integrations.github.platform_registry import (
    FRAMEWORKS,
    GITHUB_LANGUAGE_TO_SENTRY_PLATFORM,
    DetectedPlatform,
    _apply_supersession,
    _package_in_manifest,
    _PackageManifest,
)


class TestGithubLanguageMapping:
    def test_python_maps_to_python(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["Python"] == "python"

    def test_typescript_maps_to_javascript(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["TypeScript"] == "javascript"

    def test_javascript_maps_to_javascript(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["JavaScript"] == "javascript"

    def test_csharp_maps_to_dotnet(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["C#"] == "dotnet"

    def test_objectivec_maps_to_apple_ios(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["Objective-C"] == "apple-ios"

    def test_powershell_maps_to_powershell(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM["PowerShell"] == "powershell"

    def test_unmapped_language_returns_none(self) -> None:
        assert GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get("Haskell") is None


class TestPackageInManifest:
    def test_exact_match_in_dependencies(self) -> None:
        manifest = _PackageManifest(dependencies={"next", "react"}, dev_dependencies=set())
        assert _package_in_manifest("next", manifest) is True

    def test_exact_match_in_dev_dependencies(self) -> None:
        manifest = _PackageManifest(dependencies=set(), dev_dependencies={"jest"})
        assert _package_in_manifest("jest", manifest) is True

    def test_no_match(self) -> None:
        manifest = _PackageManifest(dependencies={"react"}, dev_dependencies=set())
        assert _package_in_manifest("vue", manifest) is False

    def test_prefix_match_for_composer(self) -> None:
        manifest = _PackageManifest(
            dependencies={"symfony/framework-bundle"}, dev_dependencies=set()
        )
        assert _package_in_manifest("symfony/", manifest) is True

    def test_prefix_no_match(self) -> None:
        manifest = _PackageManifest(dependencies={"laravel/framework"}, dev_dependencies=set())
        assert _package_in_manifest("symfony/", manifest) is False

    def test_npm_scoped_package_match(self) -> None:
        manifest = _PackageManifest(dependencies={"@nestjs/core"}, dev_dependencies=set())
        assert _package_in_manifest("@nestjs/core", manifest) is True
        assert _package_in_manifest("@nestjs/missing", manifest) is False


class TestApplySupersession:
    def test_nextjs_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nextjs",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-nextjs" in platforms
        assert "javascript-react" not in platforms

    def test_nuxt_supersedes_vue(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nuxt",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-vue",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-nuxt" in platforms
        assert "javascript-vue" not in platforms

    def test_remix_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-remix",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-remix" in platforms
        assert "javascript-react" not in platforms

    def test_sveltekit_supersedes_svelte(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-sveltekit",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-svelte",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-sveltekit" in platforms
        assert "javascript-svelte" not in platforms

    def test_gatsby_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-gatsby",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-gatsby" in platforms
        assert "javascript-react" not in platforms

    def test_react_native_supersedes_react(self) -> None:
        results = [
            DetectedPlatform(
                platform="react-native",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "react-native" in platforms
        assert "javascript-react" not in platforms

    def test_cloudflare_pages_supersedes_workers(self) -> None:
        results = [
            DetectedPlatform(
                platform="node-cloudflare-pages",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=50,
            ),
            DetectedPlatform(
                platform="node-cloudflare-workers",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=50,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "node-cloudflare-pages" in platforms
        assert "node-cloudflare-workers" not in platforms

    def test_no_supersession_keeps_all(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
            DetectedPlatform(
                platform="node-express",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=60,
            ),
        ]
        filtered = _apply_supersession(results)
        assert len(filtered) == 2

    def test_supersession_does_not_affect_unrelated(self) -> None:
        results = [
            DetectedPlatform(
                platform="javascript-nextjs",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=99,
            ),
            DetectedPlatform(
                platform="node-express",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=60,
            ),
            DetectedPlatform(
                platform="javascript-react",
                language="JavaScript",
                bytes=50000,
                confidence="high",
                priority=70,
            ),
        ]
        filtered = _apply_supersession(results)
        platforms = [r["platform"] for r in filtered]
        assert "javascript-nextjs" in platforms
        assert "node-express" in platforms
        assert "javascript-react" not in platforms


class TestFrameworksIntegrity:
    """Validate the FRAMEWORKS list is internally consistent.

    Catches typos and structural errors that would silently cause
    framework definitions to never match at runtime.
    """

    def test_no_unintentional_duplicate_platform_ids(self) -> None:
        # Some platforms intentionally have multiple entries with different
        # base_platforms (e.g. android has both java and kotlin entries).
        # Duplicates are only valid when each entry has a distinct base_platform.
        from collections import Counter

        entries = [(fw["platform"], fw["base_platform"]) for fw in FRAMEWORKS]
        entry_counts = Counter(entries)
        exact_dupes = [e for e, count in entry_counts.items() if count > 1]
        assert exact_dupes == [], f"Duplicate (platform, base_platform) pairs: {exact_dupes}"

    def test_all_base_platforms_are_valid(self) -> None:
        valid_base_platforms = set(GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.values())
        for fw in FRAMEWORKS:
            assert fw["base_platform"] in valid_base_platforms, (
                f"{fw['platform']} has base_platform={fw['base_platform']!r} "
                f"which is not a value in GITHUB_LANGUAGE_TO_SENTRY_PLATFORM"
            )

    def test_all_supersedes_targets_exist(self) -> None:
        all_platform_ids = {fw["platform"] for fw in FRAMEWORKS}
        all_base_platforms = set(GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.values())
        valid_targets = all_platform_ids | all_base_platforms

        for fw in FRAMEWORKS:
            for target in fw.get("supersedes", []):
                assert target in valid_targets, (
                    f"{fw['platform']} supersedes {target!r} "
                    f"which does not exist as a framework or base platform"
                )

    def test_every_framework_has_at_least_one_rule(self) -> None:
        for fw in FRAMEWORKS:
            has_rules = fw.get("every") or fw.get("some")
            assert has_rules, f"{fw['platform']} has no detection rules (no every or some)"

    def test_sort_values_are_positive_integers(self) -> None:
        for fw in FRAMEWORKS:
            assert isinstance(fw["sort"], int), (
                f"{fw['platform']} sort={fw['sort']!r} is not an int"
            )
            assert 1 <= fw["sort"] <= 99, (
                f"{fw['platform']} sort={fw['sort']} is outside valid range 1-99"
            )

    def test_no_rule_has_match_content_without_file_source(self) -> None:
        for fw in FRAMEWORKS:
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" in rule:
                    assert "path" in rule or "match_ext" in rule, (
                        f"{fw['platform']} has match_content without path or match_ext — "
                        f"content matching requires a file source to read"
                    )
