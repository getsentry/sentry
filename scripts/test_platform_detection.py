#!/usr/bin/env python
# ruff: noqa: T201
# flake8: noqa: S002, S003
"""
Test platform detection against real GitHub repository data stored locally.

Usage:
    # First time: fetch and cache repo data from GitHub
    GITHUB_TOKEN=ghp_xxx .venv/bin/python scripts/test_platform_detection.py --fetch

    # Subsequent runs: replay from local fixtures (no token needed)
    .venv/bin/python scripts/test_platform_detection.py

Fixtures are stored in scripts/platform_detection_fixtures/.
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

FIXTURES_DIR = Path(__file__).parent / "platform_detection_fixtures"

# (owner/repo, expected top platform)
# These should be real-world apps, not framework source repos or boilerplates.
# Some niche frameworks only have example apps available.
TEST_REPOS: list[tuple[str, str]] = [
    # === JavaScript meta-frameworks ===
    ("vercel/next.js", "javascript-nextjs"),
    ("sawirricardo/remix-realworld", "javascript-remix"),
    ("nuxt/nuxt.com", "javascript-nuxt"),
    ("withastro/astro.build", "javascript-astro"),
    ("taniarascia/taniarascia.com", "javascript-gatsby"),
    ("sveltejs/realworld", "javascript-sveltekit"),
    ("solidjs/solid-docs", "javascript-solidstart"),
    ("TanStack/tanstack.com", "javascript-tanstackstart-react"),
    # === JavaScript UI frameworks ===
    ("artsy/force", "javascript-react"),
    ("gothinkster/vue-realworld-example-app", "javascript-vue"),
    ("gothinkster/angular-realworld-example-app", "javascript-angular"),
    ("open-source-labs/SvelteStorm", "javascript-svelte"),
    ("solidjs/solid-realworld", "javascript-solid"),
    ("gothinkster/ember-realworld", "javascript-ember"),
    ("grafana/grafana", "javascript-react-router"),
    # === JavaScript mobile/desktop ===
    ("artsy/eigen", "react-native"),
    ("webtorrent/webtorrent-desktop", "electron"),
    ("ionic-team/capacitor-testapp", "capacitor"),
    ("ionic-team/ionic-react-conference-app", "ionic"),
    ("openfoodfacts/openfoodfacts-cordova-app", "cordova"),
    # === Node.js server frameworks ===
    ("agenda/agendash", "node-express"),
    ("labelzoom/labelzoom-cf-api-proxy", "node-hono"),
    ("chrisveness/koa-sample-web-app-api-mysql", "node-koa"),
    ("lujakob/nestjs-realworld-example-app", "node-nestjs"),
    ("delvedor/fastify-example", "node-fastify"),
    ("karma-runner/karma", "node-connect"),
    ("devinivy/hapipal-realworld-example-app", "node-hapi"),
    # === Node.js serverless/edge ===
    ("madhurajayashanka/AWS-Serverless-CRUD-NodeJS", "node-awslambda"),
    ("chatwoot/google-cloud-functions-demo", "node-gcpfunctions"),
    ("x-t/serverless-gdrive-twitter", "node-azurefunctions"),
    ("zhengkyl/qrframe", "node-cloudflare-pages"),
    ("eidam/cf-workers-status-page", "node-cloudflare-workers"),
    # === Node.js / JS runtimes ===
    ("conventional-changelog/commitlint", "node"),
    ("jellydn/elysia-demo-app", "bun"),
    ("ryo-ma/github-profile-trophy", "deno"),
    # === Python web frameworks ===
    ("getsentry/sentry", "python-django"),
    ("nsidnev/fastapi-realworld-example-app", "python-fastapi"),
    ("codefresh-contrib/python-flask-sample-app", "python-flask"),
    ("nomhoi/aiohttp-realworld-example-app", "python-aiohttp"),
    ("pybites/pytip", "python-bottle"),
    ("alysivji/falcon-batteries-included", "python-falcon"),
    ("teamniteo/pyramid-realworld-example-app", "python-pyramid"),
    ("rayluo/python-webapp-quart", "python-quart"),
    ("jaggerwang/sanic-in-practice", "python-sanic"),
    ("nateraw/starlette-app", "python-starlette"),
    ("Hipo/hipochat", "python-tornado"),
    # python-tryton: no public repo found with trytond in requirements/pyproject/Pipfile
    # === Python serverless ===
    ("sbraverman/jiralice", "python-chalice"),
    ("gyukebox/realworld-serverless-python", "python-awslambda"),
    ("CthtufsPetProjects/google-cloud-function-gen2-template", "python-gcpfunctions"),
    # === Python ASGI/WSGI/task queues ===
    ("guyo13/falcon-app-boilerplate", "python-asgi"),
    ("Scalingo/sample-python-celery", "python-celery"),
    ("microsoft/azure-python-redis-queue-processor", "python-rq"),
    # === Ruby ===
    ("chatwoot/chatwoot", "ruby-rails"),
    ("puma/puma", "ruby-rack"),
    # === PHP ===
    ("laravel/laravel", "php-laravel"),
    ("wallabag/wallabag", "php-symfony"),
    # === Java ===
    ("macrozheng/mall", "java-spring-boot"),
    ("spring-petclinic/spring-framework-petclinic", "java-spring"),
    ("conductor-oss/conductor", "java-log4j2"),
    ("apolloconfig/apollo", "java-logback"),
    # === Go ===
    ("cli/cli", "go"),
    ("usememos/memos", "go-echo"),
    ("go-admin-team/go-admin", "go-gin"),
    ("JioTV-Go/jiotv_go", "go-fiber"),
    ("yunginnanet/HellPot", "go-fasthttp"),
    ("mlogclub/bbs-go", "go-iris"),
    ("heketi/heketi", "go-negroni"),
    # === .NET ===
    ("cornflourblue/aspnet-core-3-registration-login-api", "dotnet-aspnetcore"),
    ("ghk/kawaldesa", "dotnet-aspnet"),
    ("behl1anmol/Todo.me", "dotnet-maui"),
    ("xM4ddy/OFGB", "dotnet-wpf"),
    ("lzpong/RDCMan", "dotnet-winforms"),
    ("Project-Helin/customer-app", "dotnet-xamarin"),
    ("mcasperson/AWSLambdaCSharp", "dotnet-awslambda"),
    ("tina-hello/doh-gcf", "dotnet-gcpfunctions"),
    # === Mobile / Desktop / Gaming ===
    ("gskinnerTeam/flutter-wonderous-app", "flutter"),
    ("Finb/Bark", "apple-ios"),
    ("sindresorhus/Gifski", "apple-macos"),
    ("Qv2ray/Qv2ray", "native-qt"),
    ("Unity-Technologies/FPSSample", "unity"),
    ("tomlooman/ActionRoguelike", "unreal"),
    ("lampe-games/godot-open-rts", "godot"),
    ("D-clock/AndroidDaemonService", "android"),
    # === Base language platforms ===
    ("yt-dlp/yt-dlp", "python"),
    ("prettier/prettier", "javascript"),
    ("apache/kafka", "java"),
    ("fastlane/fastlane", "ruby"),
    ("nextcloud/server", "php"),
    ("lencx/ChatGPT", "rust"),
    ("gotson/komga", "kotlin"),
    ("bonfire-networks/bonfire-app", "elixir"),
    ("Sycnex/Windows10Debloater", "powershell"),
    ("sass/dart-sass", "dart"),
    # === Synthetic fixtures (no real repo available) ===
    ("synthetic/python-tryton", "python-tryton"),
    ("synthetic/python-wsgi", "python-wsgi"),
    ("synthetic/dotnet-console", "dotnet"),
    ("synthetic/native-c", "native"),
]


def _repo_fixture_dir(repo: str) -> Path:
    return FIXTURES_DIR / repo.replace("/", "--")


def _api_cache_path(repo: str, api_path: str) -> Path:
    """Map an API path to a fixture file path."""
    # Strip leading slash, replace remaining slashes with --
    safe = api_path.lstrip("/").replace("/", "--")
    return _repo_fixture_dir(repo) / "api" / f"{safe}.json"


def fetch_fixtures(token: str) -> None:
    """Hit GitHub API and save responses as local fixtures."""
    import requests

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    for repo, _ in TEST_REPOS:
        repo_dir = _repo_fixture_dir(repo)
        if (repo_dir / "languages.json").exists():
            print(f"Skipping {repo} (fixtures exist)")
            continue
        print(f"Fetching {repo}...")

        # 1. Languages
        resp = requests.get(f"https://api.github.com/repos/{repo}/languages", headers=headers)
        resp.raise_for_status()
        lang_path = repo_dir / "languages.json"
        lang_path.parent.mkdir(parents=True, exist_ok=True)
        lang_path.write_text(json.dumps(resp.json(), indent=2))

        # 2. Root directory listing
        resp = requests.get(f"https://api.github.com/repos/{repo}/contents", headers=headers)
        resp.raise_for_status()
        root_entries = resp.json()
        cache_path = _api_cache_path(repo, f"/repos/{repo}/contents")
        cache_path.parent.mkdir(parents=True, exist_ok=True)
        cache_path.write_text(json.dumps(root_entries, indent=2))

        # 3. Fetch files that detect_platforms might need (config/manifest files)
        files_to_fetch = _get_interesting_files(root_entries)
        for filename in files_to_fetch:
            resp = requests.get(
                f"https://api.github.com/repos/{repo}/contents/{filename}",
                headers=headers,
            )
            if resp.status_code == 404:
                continue
            resp.raise_for_status()
            cache_path = _api_cache_path(repo, f"/repos/{repo}/contents/{filename}")
            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_text(json.dumps(resp.json(), indent=2))

        print(f"  saved to {repo_dir}")


def _get_interesting_files(root_entries: list[dict[str, Any]]) -> list[str]:
    """Determine which root files detect_platforms will try to fetch."""
    # These are the config/manifest files that framework rules look for.
    # We fetch all that exist in the root listing so the replay client has them.
    interesting = {
        # JS/Node package manifests and configs
        "package.json",
        "next.config.js",
        "next.config.mjs",
        "next.config.ts",
        "nuxt.config.js",
        "nuxt.config.ts",
        "angular.json",
        "svelte.config.js",
        "svelte.config.ts",
        "gatsby-config.js",
        "gatsby-config.ts",
        "remix.config.js",
        "remix.config.mjs",
        "astro.config.mjs",
        "astro.config.ts",
        "astro.config.js",
        "ember-cli-build.js",
        "config.xml",
        # Node runtime/serverless
        ".nvmrc",
        ".node-version",
        "nodemon.json",
        "wrangler.toml",
        "host.json",
        "local.settings.json",
        "serverless.yml",
        "serverless.yaml",
        # JS runtimes
        "bunfig.toml",
        "bun.lockb",
        "deno.json",
        "deno.jsonc",
        # Python
        "requirements.txt",
        "Pipfile",
        "pyproject.toml",
        "setup.py",
        "setup.cfg",
        "manage.py",
        "app.py",
        "wsgi.py",
        "asgi.py",
        # Go
        "go.mod",
        # Rust
        "Cargo.toml",
        # Ruby
        "Gemfile",
        # PHP
        "composer.json",
        "artisan",
        "wp-config.php",
        # Java/Kotlin
        "build.gradle",
        "build.gradle.kts",
        "pom.xml",
        "settings.gradle",
        "settings.gradle.kts",
        # .NET
        "appsettings.json",
        # Dart/Flutter
        "pubspec.yaml",
        # Swift/Apple
        "Package.swift",
        "Podfile",
        # Elixir
        "mix.exs",
        # Native/Gaming
        "CMakeLists.txt",
        "project.godot",
        # Deployment
        "Procfile",
        "vercel.json",
        "Dockerfile",
    }
    # Extensions that match_ext rules look for (file content may be inspected)
    # .xcodeproj is a directory, detected via match_dir in the root listing
    interesting_exts = {".csproj", ".uproject", ".qrc"}

    root_names = {e["name"] for e in root_entries if "name" in e}
    result = set()
    for name in root_names:
        if name in interesting:
            result.add(name)
        elif any(name.endswith(ext) for ext in interesting_exts):
            result.add(name)
    return sorted(result)


def make_replay_client(repo: str) -> Any:
    """Create a client shim that reads from local fixtures."""
    from sentry.shared_integrations.exceptions import ApiError

    repo_dir = _repo_fixture_dir(repo)

    class ReplayClient:
        def get_languages(self, repo_name: str) -> dict[str, int]:
            return json.loads((repo_dir / "languages.json").read_text())

        def get(self, path: str, params: dict[str, Any] | None = None) -> Any:
            cache_path = _api_cache_path(repo, path)
            if not cache_path.exists():
                raise ApiError("Not Found", code=404)
            return json.loads(cache_path.read_text())

    return ReplayClient()


def _bootstrap_sentry() -> None:
    """Bootstrap Sentry enough to import platform_detection."""
    from sentry.runner import configure

    configure()


def run_detection() -> None:
    """Run detect_platforms against local fixtures."""
    _bootstrap_sentry()

    from sentry.integrations.github.platform_detection import detect_platforms

    passed = 0
    failed = 0

    for repo, expected_top in TEST_REPOS:
        repo_dir = _repo_fixture_dir(repo)
        if not repo_dir.exists():
            print(f"\n{repo}")
            print("  SKIP: no fixtures (run with --fetch first)")
            continue

        print(f"\n{repo}")
        client = make_replay_client(repo)
        try:
            platforms = detect_platforms(client, repo)  # type: ignore[arg-type]
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            continue

        if not platforms:
            print("  (no platforms detected)")
            failed += 1
            continue

        for i, p in enumerate(platforms, 1):
            marker = ""
            if i == 1 and p["platform"] == expected_top:
                marker = "  <-- expected"
            print(
                f"  {i}. {p['platform']:<25} ({p['language']}, {p['priority']}, {p['confidence']}){marker}"
            )

        top = platforms[0]["platform"]
        if top == expected_top:
            print(f"  PASS: top={top}")
            passed += 1
        else:
            print(f"  FAIL: top={top}, expected={expected_top}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")


def main() -> None:
    if "--fetch" in sys.argv:
        token = os.environ.get("GITHUB_TOKEN")
        if not token:
            print("Error: GITHUB_TOKEN env var required for --fetch")
            sys.exit(1)
        fetch_fixtures(token)
        print("\nFixtures saved. Run without --fetch to test.")
    else:
        run_detection()


if __name__ == "__main__":
    main()
