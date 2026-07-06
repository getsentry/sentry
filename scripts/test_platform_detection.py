#!/usr/bin/env python
# ruff: noqa: T201
# flake8: noqa: S002, S003
"""
Test platform detection against real GitHub repository data stored locally.

Usage:
    # First time: fetch and cache repo data from GitHub
    GITHUB_TOKEN=ghp_xxx .venv/bin/python scripts/test_platform_detection.py --fetch

    # Re-run after the multi detector is built (tops up tree fixtures only,
    # skips already-cached artifacts):
    GITHUB_TOKEN=ghp_xxx .venv/bin/python scripts/test_platform_detection.py --fetch

    # Run old single-framework detector (default — same as before):
    .venv/bin/python scripts/test_platform_detection.py
    .venv/bin/python scripts/test_platform_detection.py --single

    # Run new multi-platform detector:
    .venv/bin/python scripts/test_platform_detection.py --multi

    # Side-by-side diff (old vs new); exits non-zero on any regression:
    .venv/bin/python scripts/test_platform_detection.py --diff

Fixtures are stored in scripts/platform_detection_fixtures/.
"""

from __future__ import annotations

import argparse
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
    ("PuruVJ/macos-web", "javascript-svelte"),
    ("solidjs/solid-realworld", "javascript-solid"),
    ("gothinkster/ember-realworld", "javascript-ember"),
    ("grafana/grafana", "javascript-react-router"),
    # === JavaScript mobile/desktop ===
    ("artsy/eigen", "react-native"),
    ("webtorrent/webtorrent-desktop", "electron"),
    ("ionic-team/capacitor-testapp", "capacitor"),
    ("ionicthemes/ionic-forms-and-validations", "ionic"),
    ("openfoodfacts/openfoodfacts-cordova-app", "cordova"),
    # === Node.js server frameworks ===
    ("agenda/agendash", "node-express"),
    ("coldter/hono-node-starter", "node-hono"),
    ("chrisveness/koa-sample-web-app-api-mysql", "node-koa"),
    ("lujakob/nestjs-realworld-example-app", "node-nestjs"),
    ("Tony133/fastify-api-boilerplate-jwt", "node-fastify"),
    ("karma-runner/karma", "node-connect"),
    ("devinivy/hapipal-realworld-example-app", "node-hapi"),
    # === Node.js serverless/edge ===
    ("madhurajayashanka/AWS-Serverless-CRUD-NodeJS", "node-awslambda"),
    ("chatwoot/google-cloud-functions-demo", "node-gcpfunctions"),
    ("x-t/serverless-gdrive-twitter", "node-azurefunctions"),
    ("json-ld/json-ld.org", "node-cloudflare-pages"),
    ("eidam/cf-workers-status-page", "node-cloudflare-workers"),
    # === Node.js / JS runtimes ===
    ("puppeteer/puppeteer", "node"),
    ("cdbrw/bun-elysia-drizzle-base", "bun"),
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
    ("cubeapm/sample_app_python_sanic", "python-sanic"),
    ("nateraw/starlette-app", "python-starlette"),
    ("Hipo/hipochat", "python-tornado"),
    # python-tryton: no public repo found with trytond in requirements/pyproject/Pipfile
    # === Python serverless ===
    ("sbraverman/jiralice", "python-chalice"),
    ("gyukebox/realworld-serverless-python", "python-awslambda"),
    ("CthtufsPetProjects/google-cloud-function-gen2-template", "python-gcpfunctions"),
    # === Python ASGI/WSGI/task queues ===
    ("mossadnik/celery-example-local-filesystem", "python-celery"),
    ("microsoft/azure-python-redis-queue-processor", "python-rq"),
    # === Ruby ===
    ("chatwoot/chatwoot", "ruby-rails"),
    ("puma/puma", "ruby-rack"),
    # === PHP ===
    ("laravel/laravel", "php-laravel"),
    ("wallabag/wallabag", "php-symfony"),
    # === Java ===
    ("macrozheng/mall", "java-spring-boot"),
    ("rstoyanchev/spring-websocket-portfolio", "java-spring"),
    ("stevensouza/automon", "java-log4j2"),
    ("apache/curator", "java-logback"),
    # === Go ===
    ("cli/cli", "go"),
    ("usememos/memos", "go-echo"),
    ("go-admin-team/go-admin", "go-gin"),
    ("JioTV-Go/jiotv_go", "go-fiber"),
    ("yunginnanet/HellPot", "go-fasthttp"),
    ("mlogclub/bbs-go", "go-gin"),
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
    ("apple/containerization", "apple-macos"),
    ("Qv2ray/Qv2ray", "native-qt"),
    ("Unity-Technologies/FPSSample", "unity"),
    ("tomlooman/ActionRoguelike", "unreal"),
    ("lampe-games/godot-open-rts", "godot"),
    ("termux/termux-app", "android"),
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
    ("synthetic/python-asgi", "python-asgi"),
    ("synthetic/python-tryton", "python-tryton"),
    ("synthetic/python-wsgi", "python-wsgi"),
    ("synthetic/dotnet-console", "dotnet"),
    ("synthetic/native-c", "native"),
]

# Multi-platform / subdir test cases.
# Each row: (repo, expected_set, forbidden_set)
#   expected_set  - every platform here must appear anywhere in results (recall)
#   forbidden_set - none of these may appear in results (precision)
#
# These repos are fetched by --fetch but are NOT included in TEST_REPOS and
# therefore do not affect the --diff zero-regression guard.
MULTI_TEST_REPOS: list[tuple[str, set[str], set[str]]] = [
    # ---------------------------------------------------------------------------
    # Case 1: multi-language monorepo
    # Goal: detect two distinct platforms (one per language stack) in one repo.
    # ---------------------------------------------------------------------------
    # Django backend (backend/) + Next.js frontend (frontend/)
    (
        "abdul-hamid-achik/django-nextjs-boilerplate",
        {"python-django", "javascript-nextjs"},
        set(),
    ),
    # Rails backend (backend/) + Vite React frontend (frontend/)
    (
        "hoshinotsuyoshi/rails-api-vite-easy-stack",
        {"ruby-rails", "javascript-react"},
        set(),
    ),
    # Spring Boot backend (backend/) + Angular frontend (frontend/)
    (
        "rehmanra/spring-boot-angular",
        {"java-spring-boot", "javascript-angular"},
        set(),
    ),
    # Nuxt 3 frontend (apps/web/) + Bun/Hono backend (apps/api/)
    (
        "Goran-n/modern-saas-stack",
        {"javascript-nuxt", "node-hono"},
        set(),
    ),
    # Go/Gin backend + Vue 3 admin frontend (app/admin/web/)
    (
        "dsmOfficial/storm",
        {"go-gin", "javascript-vue"},
        set(),
    ),
    # FastAPI backend (backend/) + Vite React frontend (frontend/)
    (
        "fastapi/full-stack-fastapi-template",
        {"python-fastapi", "javascript-react"},
        set(),
    ),
    # NestJS backend + Vue frontend (Nx monorepo)
    (
        "troncali/nest-vue",
        {"node-nestjs", "javascript-vue"},
        set(),
    ),
    # ASP.NET Core backend (apps/server/) + React frontend (apps/client/)
    (
        "MatanelGordon/csharp-react-turborepo",
        {"dotnet-aspnetcore", "javascript-react"},
        set(),
    ),
    # Flask backend (server/) + React frontend (client/)
    (
        "DanishGillani/full-stack-web-app-react-and-python",
        {"python-flask", "javascript-react"},
        set(),
    ),
    # Laravel backend + Vue frontend (real-world music streaming app)
    (
        "koel/koel",
        {"php-laravel", "javascript-vue"},
        set(),
    ),
    # Polyglot microservices, no JS in top languages: Go + Python (Online Boutique)
    (
        "GoogleCloudPlatform/microservices-demo",
        {"go", "python"},
        set(),
    ),
    # Rust + Python library (no JS in top languages): pydantic's Rust core
    (
        "pydantic/pydantic-core",
        {"rust", "python"},
        set(),
    ),
    # ---------------------------------------------------------------------------
    # Case 2: subdir-only framework
    # Goal: the framework's signal file lives only in a subdir; proves the
    # co-location indexing finds what a root-only scan would miss.
    # ---------------------------------------------------------------------------
    # Next.js in apps/web/ (nothing at root)
    (
        "ProductOfAmerica/turbo-starter",
        {"javascript-nextjs"},
        set(),
    ),
    # Nuxt 4 in apps/web/
    (
        "phiychai/turborepo-saas-starter",
        {"javascript-nuxt"},
        set(),
    ),
    # SvelteKit in apps/web/
    (
        "adidoesnt/svelte-monorepo-template",
        {"javascript-sveltekit"},
        set(),
    ),
    # Astro in apps/web/ (and apps/docs/)
    (
        "ckng/astro-turbo-boilerplate",
        {"javascript-astro"},
        set(),
    ),
    # Vite React in apps/web/
    (
        "trungung/shadcn-vite-react-typescript-monorepo",
        {"javascript-react"},
        set(),
    ),
    # Angular micro-frontends in apps/ (Turborepo)
    (
        "vugar005/youtube-webapp-turborepo",
        {"javascript-angular"},
        set(),
    ),
    # SolidStart in apps/solid/
    (
        "ssshashank/solid-turborepo",
        {"javascript-solidstart"},
        set(),
    ),
    # Vue 3 Vite in apps/web/
    (
        "StanHsieh/vue-monorepo-kit",
        {"javascript-vue"},
        set(),
    ),
    # Go/Gin backend in server/ (go.mod nested, not at root)
    (
        "calebeaires/gin-react-monorepo",
        {"go-gin"},
        set(),
    ),
    # Django backend in backend/ (manage.py nested, not at root)
    (
        "vintasoftware/django-react-boilerplate",
        {"python-django"},
        set(),
    ),
]


def _repo_fixture_dir(repo: str) -> Path:
    return FIXTURES_DIR / repo.replace("/", "--")


def _print_fetch_error_if_any(repo_dir: Path) -> bool:
    """Print a stored fetch error (e.g. a 404) if one was recorded.

    Returns True if an error was printed, so the caller knows to skip the repo
    instead of falling through to the generic "no fixtures" message.
    """
    err_path = repo_dir / "_fetch_error.json"
    if not err_path.exists():
        return False
    err = json.loads(err_path.read_text())
    print(f"  ERROR: fetch failed - HTTP {err['status']} for {err['url']}")
    return True


def _api_cache_path(repo: str, api_path: str) -> Path:
    """Map an API path to a fixture file path."""
    safe = api_path.lstrip("/").replace("/", "--")
    return _repo_fixture_dir(repo) / "api" / f"{safe}.json"


# ---------------------------------------------------------------------------
# Fetch helpers
# ---------------------------------------------------------------------------


def _fetch_if_missing(
    url: str,
    headers: dict[str, str],
    dest: Path,
    *,
    skip_codes: tuple[int, ...] = (404, 409),
    params: dict[str, str] | None = None,
) -> str:
    """GET url and write JSON to dest only if dest does not already exist.

    Returns "cached" if the fixture already existed, "fetched" if it was just
    written, or "skipped:<code>" if the request returned an ignorable HTTP
    status (so the caller can tell a cache hit apart from a 404).
    """
    import requests

    if dest.exists():
        return "cached"
    resp = requests.get(url, headers=headers, params=params)
    if resp.status_code in skip_codes:
        return f"skipped:{resp.status_code}"
    resp.raise_for_status()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(resp.json(), indent=2))
    return "fetched"


def fetch_fixtures(token: str) -> None:
    """Hit GitHub API and save responses as local fixtures.

    Each artifact is fetched only if its fixture file is missing, so
    re-running --fetch safely tops up the corpus (e.g. adding tree fixtures
    to an existing languages/contents corpus) without overwriting anything.
    """
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    # Collect all repos to fetch: TEST_REPOS single-platform rows plus any
    # repos from MULTI_TEST_REPOS that are not already covered.
    single_repos = [repo for repo, _ in TEST_REPOS]
    multi_repos = [repo for repo, _, _ in MULTI_TEST_REPOS]
    all_repos = list(dict.fromkeys(single_repos + multi_repos))  # deduped, order preserved
    multi_repo_set = set(multi_repos)

    for repo in all_repos:
        is_multi = repo in multi_repo_set
        repo_dir = _repo_fixture_dir(repo)
        print(f"\n{repo}")

        # 1. Languages (also doubles as a repo-existence probe)
        lang_path = repo_dir / "languages.json"
        lang_url = f"https://api.github.com/repos/{repo}/languages"
        lang_status = _fetch_if_missing(lang_url, headers, lang_path)
        if lang_status.startswith("skipped:"):
            code = lang_status.split(":", 1)[1]
            print(
                f"  ERROR: GitHub returned HTTP {code} for {lang_url} "
                "- repo not found / inaccessible"
            )
            repo_dir.mkdir(parents=True, exist_ok=True)
            (repo_dir / "_fetch_error.json").write_text(
                json.dumps(
                    {
                        "url": lang_url,
                        "status": int(code),
                        "reason": "not found / inaccessible",
                    },
                    indent=2,
                )
            )
            continue
        print(f"  languages: {lang_status}")

        # 2. Root directory listing
        contents_path = _api_cache_path(repo, f"/repos/{repo}/contents")
        contents_status = _fetch_if_missing(
            f"https://api.github.com/repos/{repo}/contents",
            headers,
            contents_path,
        )
        print(f"  contents:  {contents_status}")

        # 3. Interesting files referenced by framework rules
        if lang_path.exists() and contents_path.exists():
            root_entries = json.loads(contents_path.read_text())
            if isinstance(root_entries, list):
                files_to_fetch = _get_interesting_files(root_entries)
                fetched_files = 0
                for filename in files_to_fetch:
                    dest = _api_cache_path(repo, f"/repos/{repo}/contents/{filename}")
                    status = _fetch_if_missing(
                        f"https://api.github.com/repos/{repo}/contents/{filename}",
                        headers,
                        dest,
                    )
                    if status == "fetched":
                        fetched_files += 1
                if fetched_files:
                    print(f"  files:     fetched {fetched_files} new")
                else:
                    print("  files:     cached")

        # 4. Recursive git tree (needed by detect_platforms_multi)
        tree_path = _api_cache_path(repo, f"/repos/{repo}/git/trees/HEAD")
        tree_status = _fetch_if_missing(
            f"https://api.github.com/repos/{repo}/git/trees/HEAD",
            headers,
            tree_path,
            skip_codes=(404, 409),
            params={"recursive": "1"},
        )
        print(f"  tree:      {tree_status}")

        # 5. Subdir manifest files referenced by framework rules.
        # Only run for multi-platform repos (MULTI_TEST_REPOS): single-platform
        # repos only need root-level content reads, and large trees would cause
        # --fetch to stall fetching hundreds of subdir package.json files.
        if is_multi and tree_path.exists():
            tree_data = json.loads(tree_path.read_text())
            tree_entries = tree_data.get("tree", [])
            subdir_paths = _get_interesting_subdir_paths(tree_entries)
            fetched_subdir = 0
            for full_path in subdir_paths:
                dest = _api_cache_path(repo, f"/repos/{repo}/contents/{full_path}")
                status = _fetch_if_missing(
                    f"https://api.github.com/repos/{repo}/contents/{full_path}",
                    headers,
                    dest,
                )
                if status == "fetched":
                    fetched_subdir += 1
            if fetched_subdir:
                print(f"  subdir:    fetched {fetched_subdir} new")
            else:
                print("  subdir:    cached")


def _get_interesting_files(root_entries: list[dict[str, Any]]) -> list[str]:
    """Determine which root files detect_platforms will try to fetch."""
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
    interesting_exts = {".csproj", ".uproject", ".qrc"}

    root_names = {e["name"] for e in root_entries if "name" in e}
    result = set()
    for name in root_names:
        if name in interesting:
            result.add(name)
        elif any(name.endswith(ext) for ext in interesting_exts):
            result.add(name)
    return sorted(result)


# Prefixes that the multi-platform detector ignores; skip fetching content
# inside them so we don't pull down hundreds of vendored-dep manifests.
_IGNORED_PREFIXES = (
    "node_modules/",
    "vendor/",
    ".git/",
    "__pycache__/",
    ".venv/",
    "venv/",
    "dist/",
    "build/",
    ".next/",
)


def _get_interesting_subdir_paths(tree_entries: list[dict[str, Any]]) -> list[str]:
    """Return full paths of interesting manifests that live *below* the root.

    This is the companion to _get_interesting_files: instead of matching root
    entry names, it matches every blob in the recursive tree by basename and
    returns the full path so the detector can replay subdir content reads.
    Paths inside ignored directories (node_modules, vendor, …) are excluded.
    """
    interesting = {
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
        ".nvmrc",
        ".node-version",
        "nodemon.json",
        "wrangler.toml",
        "host.json",
        "local.settings.json",
        "serverless.yml",
        "serverless.yaml",
        "bunfig.toml",
        "bun.lockb",
        "deno.json",
        "deno.jsonc",
        "requirements.txt",
        "Pipfile",
        "pyproject.toml",
        "setup.py",
        "setup.cfg",
        "manage.py",
        "app.py",
        "wsgi.py",
        "asgi.py",
        "go.mod",
        "Cargo.toml",
        "Gemfile",
        "composer.json",
        "artisan",
        "wp-config.php",
        "build.gradle",
        "build.gradle.kts",
        "pom.xml",
        "settings.gradle",
        "settings.gradle.kts",
        "appsettings.json",
        "pubspec.yaml",
        "Package.swift",
        "Podfile",
        "mix.exs",
        "CMakeLists.txt",
        "project.godot",
        "Procfile",
        "vercel.json",
        "Dockerfile",
    }
    interesting_exts = {".csproj", ".uproject", ".qrc"}

    result = []
    for entry in tree_entries:
        path = entry.get("path", "")
        if entry.get("type") != "blob":
            continue
        if "/" not in path:
            # Root-level files are covered by step 3 already.
            continue
        if any(path.startswith(prefix) for prefix in _IGNORED_PREFIXES):
            continue
        basename = path.rsplit("/", 1)[-1]
        if basename in interesting or any(basename.endswith(ext) for ext in interesting_exts):
            result.append(path)
    return sorted(result)


# ---------------------------------------------------------------------------
# Replay client
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Shared display helper
# ---------------------------------------------------------------------------


def _print_platforms(platforms: list[dict[str, Any]], expected_top: str) -> None:
    """Print a ranked platform list, marking the expected result wherever it lands."""
    if not platforms:
        print("  (no platforms detected)")
        return
    for i, p in enumerate(platforms, 1):
        marker = "  <-- expected" if p["platform"] == expected_top else ""
        b = p.get("bytes", 0)
        if b >= 1_000_000:
            bytes_str = f"{b / 1_000_000:.1f}M"
        elif b >= 1_000:
            bytes_str = f"{b / 1_000:.0f}K"
        else:
            bytes_str = str(b)
        print(
            f"  {i}. {p['platform']:<25} ({p['language']}: {bytes_str}, {p['priority']}, {p['confidence']}){marker}"
        )


# ---------------------------------------------------------------------------
# Bootstrap
# ---------------------------------------------------------------------------


def _bootstrap_sentry() -> None:
    from sentry.runner import configure

    configure()


# ---------------------------------------------------------------------------
# --single mode
# ---------------------------------------------------------------------------


def run_single() -> None:
    """Run detect_platforms (old single-framework detector) against local fixtures."""
    _bootstrap_sentry()

    from sentry.integrations.github.platform_detection import detect_platforms

    passed = 0
    failed = 0

    for repo, expected_top in TEST_REPOS:
        repo_dir = _repo_fixture_dir(repo)
        if not repo_dir.exists() or (repo_dir / "_fetch_error.json").exists():
            print(f"\n{repo}")
            if not _print_fetch_error_if_any(repo_dir):
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

        _print_platforms(platforms, expected_top)

        top = platforms[0]["platform"] if platforms else None
        if top == expected_top:
            print(f"  PASS: top={top}")
            passed += 1
        else:
            print(f"  FAIL: top={top}, expected={expected_top}")
            failed += 1

    print(f"\n{'=' * 60}")
    print(f"Results: {passed} passed, {failed} failed, {passed + failed} total")


# ---------------------------------------------------------------------------
# --multi mode
# ---------------------------------------------------------------------------


def run_multi() -> None:
    """Run detect_platforms_multi (new tree-aware detector) against local fixtures."""
    _bootstrap_sentry()

    from sentry.integrations.github.multi_platform_detection import detect_platforms_multi

    passed = 0
    failed = 0

    for repo, expected_top in TEST_REPOS:
        repo_dir = _repo_fixture_dir(repo)
        if not repo_dir.exists() or (repo_dir / "_fetch_error.json").exists():
            print(f"\n{repo}")
            if not _print_fetch_error_if_any(repo_dir):
                print("  SKIP: no fixtures (run with --fetch first)")
            continue

        tree_path = _api_cache_path(repo, f"/repos/{repo}/git/trees/HEAD")
        if not tree_path.exists():
            print(f"\n{repo}")
            print("  SKIP: no tree fixture (re-run --fetch)")
            continue

        print(f"\n{repo}")
        client = make_replay_client(repo)
        try:
            result = detect_platforms_multi(client, repo)  # type: ignore[arg-type]
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            continue

        platforms = result["platforms"]
        _print_platforms(platforms, expected_top)
        languages = client.get_languages(repo)
        lang_parts = ", ".join(
            f"{lang}: {bytes_:,}"
            for lang, bytes_ in sorted(languages.items(), key=lambda x: x[1], reverse=True)
        )
        print(f"  languages: {lang_parts}")
        print(
            f"  k_candidate={result['k_candidate']}  "
            f"tree_entries={result['tree_entry_count']}  "
            f"truncated={result['is_truncated']}"
        )

        top = platforms[0]["platform"] if platforms else None
        platform_set = {p["platform"] for p in platforms}
        if expected_top in platform_set:
            marker = (
                ""
                if top == expected_top
                else f" (at #{next(i for i, p in enumerate(platforms, 1) if p['platform'] == expected_top)})"
            )
            print(f"  PASS: top={top}{marker}")
            passed += 1
        else:
            print(f"  FAIL: top={top}, expected={expected_top} not in results")
            failed += 1

    # --- Multi-platform set-based assertions (MULTI_TEST_REPOS) ---
    # Recall: every expected platform must appear somewhere in the results.
    # Precision: no forbidden platform may appear in the results.
    print(f"\n{'=' * 60}")
    print("Multi-platform set assertions (MULTI_TEST_REPOS)")

    multi_passed = 0
    multi_failed = 0

    for repo, expected_set, forbidden_set in MULTI_TEST_REPOS:
        repo_dir = _repo_fixture_dir(repo)
        if not repo_dir.exists() or (repo_dir / "_fetch_error.json").exists():
            print(f"\n{repo}")
            if not _print_fetch_error_if_any(repo_dir):
                print("  SKIP: no fixtures (run with --fetch first)")
            continue

        tree_path = _api_cache_path(repo, f"/repos/{repo}/git/trees/HEAD")
        if not tree_path.exists():
            print(f"\n{repo}")
            print("  SKIP: no tree fixture (re-run --fetch)")
            continue

        print(f"\n{repo}")
        client = make_replay_client(repo)
        try:
            result = detect_platforms_multi(client, repo)  # type: ignore[arg-type]
        except Exception as e:
            print(f"  ERROR: {e}")
            multi_failed += 1
            continue

        platforms = result["platforms"]
        platform_set = {p["platform"] for p in platforms}

        # Print detected list with expected markers
        if not platforms:
            print("  (no platforms detected)")
        for i, p in enumerate(platforms, 1):
            in_expected = p["platform"] in expected_set
            in_forbidden = p["platform"] in forbidden_set
            tag = "  <-- expected" if in_expected else ("  <-- FORBIDDEN" if in_forbidden else "")
            b = p.get("bytes", 0)
            if b >= 1_000_000:
                bytes_str = f"{b / 1_000_000:.1f}M"
            elif b >= 1_000:
                bytes_str = f"{b / 1_000:.0f}K"
            else:
                bytes_str = str(b)
            print(
                f"  {i}. {p['platform']:<25} ({p['language']}: {bytes_str}, {p['priority']}, {p['confidence']}){tag}"
            )

        print(
            f"  k_candidate={result['k_candidate']}  "
            f"tree_entries={result['tree_entry_count']}  "
            f"truncated={result['is_truncated']}"
        )

        missing = expected_set - platform_set
        fired_forbidden = forbidden_set & platform_set

        if missing:
            print(f"  FAIL (recall): missing={sorted(missing)}")
            multi_failed += 1
        elif fired_forbidden:
            print(f"  FAIL (precision): forbidden platforms detected={sorted(fired_forbidden)}")
            multi_failed += 1
        else:
            parts = []
            if expected_set:
                parts.append("all expected found")
            if forbidden_set:
                parts.append("forbidden absent")
            if not parts:
                parts.append("no assertions")
            print(f"  PASS: {'; '.join(parts)}")
            multi_passed += 1

    print(f"\n{'=' * 60}")
    print(f"Single-top results:  {passed} passed, {failed} failed, {passed + failed} total")
    print(
        f"Multi-set results:   {multi_passed} passed, {multi_failed} failed, {multi_passed + multi_failed} total"
    )


# ---------------------------------------------------------------------------
# --diff mode
# ---------------------------------------------------------------------------


def run_diff() -> int:
    """Side-by-side diff of old vs new detector.

    Classifies each repo as improved / regressed / unchanged relative to
    expected_top, and exits non-zero if any regression is found (zero-
    regression guard from multiPlatformPlan.md).
    """
    _bootstrap_sentry()

    from sentry.integrations.github.multi_platform_detection import detect_platforms_multi
    from sentry.integrations.github.platform_detection import detect_platforms

    improved: list[str] = []
    regressed: list[str] = []
    unchanged_pass: list[str] = []
    unchanged_fail: list[str] = []
    skipped: list[str] = []
    total_old_platforms = 0
    total_new_platforms = 0

    for repo, expected_top in TEST_REPOS:
        repo_dir = _repo_fixture_dir(repo)
        if not repo_dir.exists():
            skipped.append(repo)
            continue

        tree_path = _api_cache_path(repo, f"/repos/{repo}/git/trees/HEAD")
        if not tree_path.exists():
            skipped.append(repo)
            continue

        client = make_replay_client(repo)

        # Run old detector
        try:
            old_platforms = detect_platforms(client, repo)  # type: ignore[arg-type]
            old_top = old_platforms[0]["platform"] if old_platforms else None
            old_set = {p["platform"] for p in old_platforms}
        except Exception as e:
            print(f"\n{repo}")
            print(f"  OLD ERROR: {e}")
            skipped.append(repo)
            continue

        # Run new detector
        try:
            multi_result = detect_platforms_multi(client, repo)  # type: ignore[arg-type]
            new_platforms = multi_result["platforms"]
            new_top = new_platforms[0]["platform"] if new_platforms else None
            new_set = {p["platform"] for p in new_platforms}
        except Exception as e:
            print(f"\n{repo}")
            print(f"  NEW ERROR: {e}")
            skipped.append(repo)
            continue

        total_old_platforms += len(old_platforms)
        total_new_platforms += len(new_platforms)

        old_correct = old_top == expected_top
        new_correct = expected_top in new_set

        if old_correct and not new_correct:
            verdict = "REGRESSED"
            regressed.append(repo)
        elif not old_correct and new_correct:
            verdict = "IMPROVED "
            improved.append(repo)
        elif old_correct:
            verdict = "PASS     "
            unchanged_pass.append(repo)
        else:
            verdict = "FAIL     "
            unchanged_fail.append(repo)

        added = new_set - old_set
        removed = old_set - new_set

        print(f"\n{repo}  [{verdict}]")
        print(f"  old top: {old_top}  (expected: {expected_top})")
        print(f"  new top: {new_top}")
        if added:
            print(f"  +added:  {', '.join(sorted(added))}")
        if removed:
            print(f"  -removed: {', '.join(sorted(removed))}")
        print(
            f"  k_candidate={multi_result['k_candidate']}  "
            f"tree_entries={multi_result['tree_entry_count']}  "
            f"truncated={multi_result['is_truncated']}"
        )

    total = len(improved) + len(regressed) + len(unchanged_pass) + len(unchanged_fail)
    print(f"\n{'=' * 60}")
    print(f"PASS (unchanged): {len(unchanged_pass)}")
    print(f"FAIL (unchanged): {len(unchanged_fail)}")
    print(f"IMPROVED:         {len(improved)}")
    print(f"REGRESSED:        {len(regressed)}")
    print(f"SKIPPED:          {len(skipped)}")
    print(f"Total compared:   {total}")
    print(f"Old detector platforms detected (total): {total_old_platforms}")
    print(f"New detector platforms detected (total): {total_new_platforms}")

    if regressed:
        print("\nREGRESSIONS (zero-regression guard FAILED):")
        for r in regressed:
            print(f"  {r}")
        return 1
    return 0


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Test platform detection against local GitHub fixtures.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--fetch",
        action="store_true",
        help="Fetch fixtures from GitHub (requires GITHUB_TOKEN env var). "
        "Incremental: only downloads missing artifacts.",
    )
    mode.add_argument(
        "--single",
        action="store_true",
        help="Run old single-framework detector (default when no flag given).",
    )
    mode.add_argument(
        "--multi",
        action="store_true",
        help="Run new tree-aware multi-platform detector.",
    )
    mode.add_argument(
        "--diff",
        action="store_true",
        help="Side-by-side diff of old vs new detector; exits non-zero on regression.",
    )
    args = parser.parse_args()

    if args.fetch:
        token = os.environ.get("GITHUB_TOKEN")
        if not token:
            print("Error: GITHUB_TOKEN env var required for --fetch")
            sys.exit(1)
        fetch_fixtures(token)
        print("\nFixtures saved. Run without --fetch to test.")
    elif args.multi:
        run_multi()
    elif args.diff:
        sys.exit(run_diff())
    else:
        # Default (no flag or --single)
        run_single()


if __name__ == "__main__":
    main()
