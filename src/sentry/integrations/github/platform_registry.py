from __future__ import annotations

import re
from collections import defaultdict
from collections.abc import Sequence
from typing import NotRequired, TypedDict

# ---------------------------------------------------------------------------
# Language → platform mapping (GitHub Linguist names → Sentry base platform IDs)
# ---------------------------------------------------------------------------

GITHUB_LANGUAGE_TO_SENTRY_PLATFORM: dict[str, str] = {
    "Python": "python",
    "JavaScript": "javascript",
    "TypeScript": "javascript",
    "Java": "java",
    "Kotlin": "kotlin",
    "Swift": "swift",
    "Objective-C": "apple-ios",
    "Objective-C++": "apple-ios",
    "Go": "go",
    "Ruby": "ruby",
    "PHP": "php",
    "Rust": "rust",
    "C#": "dotnet",
    "Dart": "dart",
    "Elixir": "elixir",
    "C": "native",
    "C++": "native",
    "GDScript": "godot",
    "PowerShell": "powershell",
}

# Languages with no Sentry SDK — filtered out of detection results
IGNORED_LANGUAGES = frozenset(
    {
        "Shell",
        "Makefile",
        "Dockerfile",
        "HTML",
        "CSS",
        "SCSS",
        "Less",
        "Vim Script",
        "Emacs Lisp",
        "Nix",
        "Starlark",
        "HCL",
        "Jsonnet",
        "Batchfile",
        "CMake",
        "M4",
        "Roff",
        "TeX",
        "XSLT",
        "PLpgSQL",
        "PLSQL",
        "TSQL",
    }
)

# ---------------------------------------------------------------------------
# TypedDicts
# ---------------------------------------------------------------------------


class DetectedPlatform(TypedDict):
    platform: str  # Sentry platform ID, e.g. "python-django"
    language: str  # GitHub Linguist name, e.g. "Python"
    bytes: int  # Bytes of code in that language
    confidence: str  # "high" (framework detected) or "medium" (language only)
    priority: int  # Higher = more relevant for onboarding


class DetectorRule(TypedDict, total=False):
    path: str  # File must exist in root directory
    match_content: str  # Regex pattern to match in file content (requires path)
    match_package: str  # Package name in package.json/composer.json deps
    match_dir: str  # Directory must exist in root
    match_ext: str  # File extension must exist in root (e.g., ".csproj")


class FrameworkDef(TypedDict):
    platform: str  # Sentry platform ID, e.g. "javascript-nextjs"
    sort: int  # Lower = higher priority
    base_platform: str  # Language group, e.g. "javascript"
    every: NotRequired[list[DetectorRule]]  # ALL must match (AND)
    some: NotRequired[list[DetectorRule]]  # At least ONE must match (OR)
    supersedes: NotRequired[list[str]]  # Platform IDs this makes redundant


class _PackageManifest(TypedDict):
    dependencies: set[str]
    dev_dependencies: set[str]


# ---------------------------------------------------------------------------
# Framework definitions
#
# sort tiers:
#   sort=1    Meta / cross-platform   Next.js, Remix, React Native, Flutter
#   sort=10   Primary frameworks      Django, Rails, React, Spring Boot
#   sort=20   Secondary frameworks    Flask, Express, Go frameworks, Symfony
#   sort=30   Niche frameworks        Starlette, Tornado, Rack
#   sort=50   Serverless / edge       AWS Lambda, GCP Functions, CF Workers
#   sort=60   Utilities / runtimes    Celery, RQ, Log4j, Node, Bun, Deno
# ---------------------------------------------------------------------------

FRAMEWORKS: list[FrameworkDef] = [
    # ===================================================================
    # JavaScript meta-frameworks (sort=1, highest priority)
    # ===================================================================
    {
        "platform": "javascript-nextjs",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "next"},
            {"path": "next.config.js"},
            {"path": "next.config.mjs"},
            {"path": "next.config.ts"},
        ],
        "supersedes": ["javascript-react"],
    },
    {
        "platform": "javascript-remix",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "remix"},
            {"path": "remix.config.js"},
            {"path": "remix.config.mjs"},
        ],
        "supersedes": ["javascript-react"],
    },
    {
        "platform": "javascript-nuxt",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "nuxt"},
            {"path": "nuxt.config.ts"},
            {"path": "nuxt.config.js"},
        ],
        "supersedes": ["javascript-vue"],
    },
    {
        "platform": "javascript-astro",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "astro"},
            {"path": "astro.config.mjs"},
            {"path": "astro.config.ts"},
            {"path": "astro.config.js"},
        ],
    },
    {
        "platform": "javascript-gatsby",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "gatsby"},
            {"path": "gatsby-config.js"},
            {"path": "gatsby-config.ts"},
        ],
        "supersedes": ["javascript-react"],
    },
    {
        "platform": "javascript-sveltekit",
        "sort": 1,
        "base_platform": "javascript",
        "some": [{"match_package": "@sveltejs/kit"}],
        "supersedes": ["javascript-svelte"],
    },
    {
        "platform": "javascript-solidstart",
        "sort": 1,
        "base_platform": "javascript",
        "some": [{"match_package": "@solidjs/start"}],
        "supersedes": ["javascript-solid"],
    },
    {
        "platform": "javascript-tanstackstart-react",
        "sort": 1,
        "base_platform": "javascript",
        "some": [{"match_package": "@tanstack/react-start"}],
        "supersedes": ["javascript-react"],
    },
    # --- Mobile / cross-platform / routing meta-frameworks (sort=1) ---
    {
        "platform": "react-native",
        "sort": 1,
        "base_platform": "javascript",
        "some": [{"match_package": "react-native"}],
        "supersedes": ["javascript-react"],
    },
    {
        "platform": "electron",
        "sort": 1,
        "base_platform": "javascript",
        "some": [{"match_package": "electron"}],
    },
    {
        "platform": "capacitor",
        "sort": 1,
        "base_platform": "javascript",
        "some": [{"match_package": "@capacitor/core"}],
    },
    {
        "platform": "javascript-react-router",
        "sort": 1,
        "base_platform": "javascript",
        "every": [{"match_package": "react-router"}, {"match_package": "react"}],
    },
    {
        "platform": "ionic",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"match_package": "@ionic/angular"},
            {"match_package": "@ionic/react"},
            {"match_package": "@ionic/vue"},
        ],
    },
    {
        "platform": "cordova",
        "sort": 1,
        "base_platform": "javascript",
        "some": [
            {"path": "config.xml", "match_content": r"cordova\.apache\.org"},
            {"match_package": "cordova-android"},
            {"match_package": "cordova-ios"},
        ],
    },
    # ===================================================================
    # JavaScript UI frameworks (sort=10)
    # ===================================================================
    {
        "platform": "javascript-react",
        "sort": 10,
        "base_platform": "javascript",
        "some": [{"match_package": "react"}],
    },
    {
        "platform": "javascript-vue",
        "sort": 10,
        "base_platform": "javascript",
        "some": [{"match_package": "vue"}],
    },
    {
        "platform": "javascript-angular",
        "sort": 10,
        "base_platform": "javascript",
        "some": [
            {"match_package": "@angular/core"},
            {"path": "angular.json"},
        ],
    },
    {
        "platform": "javascript-svelte",
        "sort": 10,
        "base_platform": "javascript",
        "some": [
            {"match_package": "svelte"},
            {"path": "svelte.config.js"},
            {"path": "svelte.config.ts"},
        ],
    },
    {
        "platform": "javascript-solid",
        "sort": 10,
        "base_platform": "javascript",
        "some": [{"match_package": "solid-js"}],
    },
    {
        "platform": "javascript-ember",
        "sort": 10,
        "base_platform": "javascript",
        "some": [
            {"match_package": "ember-source"},
            {"path": "ember-cli-build.js"},
        ],
    },
    # ===================================================================
    # JavaScript server frameworks (sort=20)
    # ===================================================================
    {
        "platform": "node-express",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "express"}],
    },
    {
        "platform": "node-hono",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "hono"}],
    },
    {
        "platform": "node-koa",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "koa"}],
    },
    {
        "platform": "node-nestjs",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "@nestjs/core"}],
    },
    {
        "platform": "node-fastify",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "fastify"}],
    },
    {
        "platform": "node-connect",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "connect"}],
    },
    {
        "platform": "node-hapi",
        "sort": 20,
        "base_platform": "javascript",
        "every": [{"match_package": "@hapi/hapi"}],
    },
    # ===================================================================
    # JavaScript serverless / edge (sort=50)
    # ===================================================================
    {
        "platform": "node-awslambda",
        "sort": 50,
        "base_platform": "javascript",
        "some": [{"path": "serverless.yml", "match_content": r"runtime:\s*nodejs"}],
    },
    {
        "platform": "node-gcpfunctions",
        "sort": 50,
        "base_platform": "javascript",
        "every": [{"match_package": "@google-cloud/functions-framework"}],
    },
    {
        "platform": "node-azurefunctions",
        "sort": 50,
        "base_platform": "javascript",
        "every": [
            {"path": "host.json", "match_content": r'"extensionBundle"'},
        ],
    },
    {
        "platform": "node-cloudflare-pages",
        "sort": 50,
        "base_platform": "javascript",
        "every": [
            {"path": "wrangler.toml", "match_content": r"pages_build_output_dir"},
        ],
        "supersedes": ["node-cloudflare-workers"],
    },
    {
        "platform": "node-cloudflare-workers",
        "sort": 50,
        "base_platform": "javascript",
        "some": [
            {"path": "wrangler.toml"},
            {"match_package": "wrangler"},
        ],
    },
    # --- Node.js base (sort=60) ---
    {
        "platform": "node",
        "sort": 60,
        "base_platform": "javascript",
        "some": [
            {"path": ".nvmrc"},
            {"path": ".node-version"},
            {"path": "nodemon.json"},
            {"path": "Procfile", "match_content": r"\bnode\b"},
        ],
    },
    # ===================================================================
    # Python frameworks
    # ===================================================================
    {
        "platform": "python-django",
        "sort": 10,
        "base_platform": "python",
        "some": [
            {"path": "manage.py"},
            {"path": "requirements.txt", "match_content": r"(?i)\bdjango\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bdjango\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bdjango\b"},
        ],
    },
    {
        "platform": "python-fastapi",
        "sort": 10,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bfastapi\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bfastapi\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bfastapi\b"},
        ],
    },
    {
        "platform": "python-flask",
        "sort": 20,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bflask\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bflask\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bflask\b"},
        ],
    },
    {
        "platform": "python-aiohttp",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\baiohttp\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\baiohttp\b"},
            {"path": "Pipfile", "match_content": r"(?i)\baiohttp\b"},
        ],
    },
    {
        "platform": "python-bottle",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bbottle\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bbottle\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bbottle\b"},
        ],
    },
    {
        "platform": "python-falcon",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bfalcon\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bfalcon\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bfalcon\b"},
        ],
    },
    {
        "platform": "python-pyramid",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bpyramid\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bpyramid\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bpyramid\b"},
        ],
    },
    {
        "platform": "python-quart",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bquart\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bquart\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bquart\b"},
        ],
    },
    {
        "platform": "python-sanic",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bsanic\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bsanic\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bsanic\b"},
        ],
    },
    {
        "platform": "python-starlette",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bstarlette\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bstarlette\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bstarlette\b"},
        ],
    },
    {
        "platform": "python-tornado",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\btornado\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\btornado\b"},
            {"path": "Pipfile", "match_content": r"(?i)\btornado\b"},
        ],
    },
    {
        "platform": "python-tryton",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\btrytond?\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\btrytond?\b"},
            {"path": "Pipfile", "match_content": r"(?i)\btrytond?\b"},
        ],
    },
    {
        "platform": "python-chalice",
        "sort": 30,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bchalice\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bchalice\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bchalice\b"},
        ],
    },
    # --- Python serverless (sort=50) ---
    {
        "platform": "python-awslambda",
        "sort": 50,
        "base_platform": "python",
        "some": [{"path": "serverless.yml", "match_content": r"runtime:\s*python"}],
    },
    {
        "platform": "python-gcpfunctions",
        "sort": 50,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bfunctions-framework\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bfunctions-framework\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bfunctions-framework\b"},
        ],
    },
    # --- Python ASGI / WSGI servers (sort=60) ---
    {
        "platform": "python-asgi",
        "sort": 60,
        "base_platform": "python",
        "some": [
            {
                "path": "requirements.txt",
                "match_content": r"(?i)\b(?:uvicorn|daphne|hypercorn)\b",
            },
            {
                "path": "pyproject.toml",
                "match_content": r"(?i)\b(?:uvicorn|daphne|hypercorn)\b",
            },
            {
                "path": "Pipfile",
                "match_content": r"(?i)\b(?:uvicorn|daphne|hypercorn)\b",
            },
        ],
    },
    {
        "platform": "python-wsgi",
        "sort": 60,
        "base_platform": "python",
        "some": [
            {
                "path": "requirements.txt",
                "match_content": r"(?i)\b(?:gunicorn|uwsgi)\b",
            },
            {
                "path": "pyproject.toml",
                "match_content": r"(?i)\b(?:gunicorn|uwsgi)\b",
            },
            {"path": "Pipfile", "match_content": r"(?i)\b(?:gunicorn|uwsgi)\b"},
        ],
    },
    # --- Python task queues / background (sort=60) ---
    {
        "platform": "python-celery",
        "sort": 60,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\bcelery\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\bcelery\b"},
            {"path": "Pipfile", "match_content": r"(?i)\bcelery\b"},
        ],
    },
    {
        "platform": "python-rq",
        "sort": 60,
        "base_platform": "python",
        "some": [
            {"path": "requirements.txt", "match_content": r"(?i)\brq\b"},
            {"path": "pyproject.toml", "match_content": r"(?i)\brq\b"},
            {"path": "Pipfile", "match_content": r"(?i)\brq\b"},
        ],
    },
    # ===================================================================
    # Ruby
    # ===================================================================
    {
        "platform": "ruby-rails",
        "sort": 10,
        "base_platform": "ruby",
        "some": [
            {"match_package": "rails"},
        ],
        "supersedes": ["ruby-rack"],
    },
    {
        "platform": "ruby-rack",
        "sort": 30,
        "base_platform": "ruby",
        "some": [
            {"match_package": "rack"},
        ],
    },
    # ===================================================================
    # PHP
    # ===================================================================
    {
        "platform": "php-laravel",
        "sort": 10,
        "base_platform": "php",
        "supersedes": ["php-symfony"],
        "some": [
            {"match_package": "laravel/framework"},
            {"path": "artisan"},
        ],
    },
    {
        "platform": "php-wordpress",
        "sort": 10,
        "base_platform": "php",
        "supersedes": ["php-symfony"],
        "some": [{"path": "wp-config.php"}],
    },
    {
        "platform": "php-symfony",
        "sort": 20,
        "base_platform": "php",
        "some": [
            {"match_package": "symfony/"},
        ],
    },
    # ===================================================================
    # Java
    # ===================================================================
    {
        "platform": "java-spring-boot",
        "sort": 10,
        "base_platform": "java",
        "some": [
            {"path": "build.gradle", "match_content": r"(?i)spring-boot"},
            {"path": "pom.xml", "match_content": r"(?i)spring-boot"},
        ],
    },
    {
        "platform": "java-spring",
        "sort": 20,
        "base_platform": "java",
        "some": [
            {"path": "build.gradle", "match_content": r"(?i)spring-framework"},
            {"path": "pom.xml", "match_content": r"(?i)spring-framework"},
        ],
    },
    {
        "platform": "java-log4j2",
        "sort": 60,
        "base_platform": "java",
        "some": [
            {"path": "build.gradle", "match_content": r"log4j-core"},
            {"path": "pom.xml", "match_content": r"log4j-core"},
        ],
    },
    {
        "platform": "java-logback",
        "sort": 60,
        "base_platform": "java",
        "some": [
            {"path": "build.gradle", "match_content": r"logback-core|logback-classic"},
            {"path": "pom.xml", "match_content": r"logback-core|logback-classic"},
        ],
    },
    # ===================================================================
    # Go
    # ===================================================================
    {
        "platform": "go-echo",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"github\.com/labstack/echo"},
        ],
    },
    {
        "platform": "go-gin",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"github\.com/gin-gonic/gin"},
        ],
    },
    {
        "platform": "go-fiber",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"github\.com/gofiber/fiber"},
        ],
    },
    {
        "platform": "go-fasthttp",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"github\.com/valyala/fasthttp"},
        ],
    },
    {
        "platform": "go-iris",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"github\.com/kataras/iris"},
        ],
    },
    {
        "platform": "go-negroni",
        "sort": 20,
        "base_platform": "go",
        "some": [
            {"path": "go.mod", "match_content": r"github\.com/urfave/negroni"},
        ],
    },
    # ===================================================================
    # Dart / Flutter
    # ===================================================================
    {
        "platform": "flutter",
        "sort": 1,
        "base_platform": "dart",
        "some": [{"match_package": "flutter"}],
    },
    # ===================================================================
    # Swift — iOS vs macOS
    # ===================================================================
    {
        "platform": "apple-ios",
        "sort": 10,
        "base_platform": "swift",
        "some": [
            {"path": "Package.swift", "match_content": r"\.iOS\s*\("},
            {"path": "Podfile", "match_content": r"platform\s*:ios\b"},
            {"match_dir": ".xcodeproj"},
        ],
    },
    {
        "platform": "apple-macos",
        "sort": 20,
        "base_platform": "swift",
        "some": [
            {"path": "Package.swift", "match_content": r"\.macOS\s*\("},
            {"path": "Podfile", "match_content": r"platform\s*:osx\b"},
        ],
    },
    # ===================================================================
    # Native (C/C++) — Qt
    # ===================================================================
    {
        "platform": "native-qt",
        "sort": 10,
        "base_platform": "native",
        "some": [
            {"match_ext": ".qrc"},
            {
                "path": "CMakeLists.txt",
                "match_content": r"find_package\s*\(\s*Qt[56]|qt_add_executable|Qt[56]::\w+",
            },
        ],
    },
    # ===================================================================
    # Mobile / Desktop / Gaming
    # ===================================================================
    {
        "platform": "unity",
        "sort": 10,
        "base_platform": "dotnet",
        "every": [{"match_dir": "Assets"}, {"match_dir": "ProjectSettings"}],
    },
    {
        "platform": "android",
        "sort": 10,
        "base_platform": "java",
        "every": [
            {"match_dir": "app"},
        ],
        "some": [
            {"path": "build.gradle", "match_content": r"android"},
            {"path": "build.gradle.kts", "match_content": r"android"},
        ],
    },
    {
        "platform": "android",
        "sort": 10,
        "base_platform": "kotlin",
        "every": [
            {"match_dir": "app"},
        ],
        "some": [
            {"path": "build.gradle", "match_content": r"android"},
            {"path": "build.gradle.kts", "match_content": r"android"},
        ],
    },
    {
        "platform": "dotnet-aspnetcore",
        "sort": 10,
        "base_platform": "dotnet",
        "every": [
            {"match_ext": ".csproj"},
            {"path": "appsettings.json"},
        ],
    },
    {
        "platform": "unreal",
        "sort": 10,
        "base_platform": "native",
        "some": [{"match_ext": ".uproject"}],
    },
    {
        "platform": "godot",
        "sort": 10,
        "base_platform": "godot",
        "some": [{"path": "project.godot"}],
    },
    # ===================================================================
    # JavaScript runtimes (sort=60)
    # ===================================================================
    {
        "platform": "bun",
        "sort": 60,
        "base_platform": "javascript",
        "some": [{"path": "bunfig.toml"}, {"path": "bun.lockb"}],
    },
    {
        "platform": "deno",
        "sort": 60,
        "base_platform": "javascript",
        "some": [{"path": "deno.json"}, {"path": "deno.jsonc"}],
    },
    # ===================================================================
    # .NET variants
    # ===================================================================
    {
        "platform": "dotnet-maui",
        "sort": 10,
        "base_platform": "dotnet",
        "every": [{"match_ext": ".csproj", "match_content": r"Microsoft\.Maui"}],
    },
    {
        "platform": "dotnet-wpf",
        "sort": 10,
        "base_platform": "dotnet",
        "every": [{"match_ext": ".csproj", "match_content": r"UseWPF"}],
    },
    {
        "platform": "dotnet-winforms",
        "sort": 10,
        "base_platform": "dotnet",
        "every": [{"match_ext": ".csproj", "match_content": r"UseWindowsForms"}],
    },
    {
        "platform": "dotnet-xamarin",
        "sort": 10,
        "base_platform": "dotnet",
        "every": [{"match_ext": ".csproj", "match_content": r"Xamarin\."}],
    },
    {
        "platform": "dotnet-aspnet",
        "sort": 20,
        "base_platform": "dotnet",
        "every": [
            {"match_ext": ".csproj", "match_content": r"Microsoft\.AspNet(?!Core)"},
        ],
    },
    {
        "platform": "dotnet-awslambda",
        "sort": 50,
        "base_platform": "dotnet",
        "every": [{"match_ext": ".csproj", "match_content": r"Amazon\.Lambda"}],
    },
    {
        "platform": "dotnet-gcpfunctions",
        "sort": 50,
        "base_platform": "dotnet",
        "every": [
            {"match_ext": ".csproj", "match_content": r"Google\.Cloud\.Functions"},
        ],
    },
]

# ---------------------------------------------------------------------------
# Derived indexes (built at module load)
# ---------------------------------------------------------------------------

_FRAMEWORKS_BY_PLATFORM: dict[str, list[FrameworkDef]] = defaultdict(list)
for _fw in FRAMEWORKS:
    _FRAMEWORKS_BY_PLATFORM[_fw["base_platform"]].append(_fw)

_SUPERSESSION_MAP: dict[str, list[str]] = {}
for _fw in FRAMEWORKS:
    if "supersedes" in _fw:
        _SUPERSESSION_MAP[_fw["platform"]] = _fw["supersedes"]
del _fw

# Platforms detected internally but not selectable in the frontend picker.
_NON_SELECTABLE_PLATFORMS = frozenset(
    {
        "php-wordpress",  # WordPress uses the base PHP SDK
        "swift",  # picker uses apple-ios / apple-macos instead
    }
)

# Package manifest files per base platform (for match_package rules)
_PACKAGE_MANIFEST_FILES: dict[str, str] = {
    "javascript": "package.json",
    "php": "composer.json",
    "dart": "pubspec.yaml",
    "ruby": "Gemfile",
}

# ---------------------------------------------------------------------------
# Core rule-matching functions
# ---------------------------------------------------------------------------


def _package_in_manifest(package_name: str, manifest: _PackageManifest | None) -> bool:
    """Check if a package exists in a manifest's dependencies or devDependencies."""
    if manifest is None:
        return False
    all_deps = manifest["dependencies"] | manifest["dev_dependencies"]
    if package_name in all_deps:
        return True
    # Prefix match for composer.json patterns like "symfony/"
    if package_name.endswith("/"):
        return any(dep.startswith(package_name) for dep in all_deps)
    return False


def _rule_matches(
    rule: DetectorRule,
    root_files: set[str] | None,
    file_contents: dict[str, str],
    package_manifest: _PackageManifest | None,
    root_dirs: set[str] | None = None,
) -> bool:
    """Evaluate a single detector rule against repository state."""
    if "match_package" in rule:
        return _package_in_manifest(rule["match_package"], package_manifest)

    if "match_dir" in rule:
        if root_dirs is None:
            return False
        dirname = rule["match_dir"]
        if dirname.startswith("."):
            return any(d.endswith(dirname) for d in root_dirs)
        return dirname in root_dirs

    if "match_ext" in rule:
        if root_files is None:
            return False
        ext = rule["match_ext"]
        matching_files = [f for f in root_files if f.endswith(ext)]
        if not matching_files:
            return False
        if "match_content" not in rule:
            return True
        pattern = rule["match_content"]
        for f in matching_files:
            content = file_contents.get(f)
            if content and re.search(pattern, content):
                return True
        return False

    path = rule.get("path")
    if path is None:
        return False

    if "match_content" in rule:
        content = file_contents.get(path)
        if content is None:
            return False
        return bool(re.search(rule["match_content"], content))

    if root_files is None:
        return False
    return path in root_files


def _framework_matches(
    fw: FrameworkDef,
    root_files: set[str] | None,
    file_contents: dict[str, str],
    package_manifest: _PackageManifest | None,
    root_dirs: set[str] | None = None,
) -> bool:
    """Evaluate whether a framework definition matches the repository."""
    every: Sequence[DetectorRule] = fw.get("every", [])
    some: Sequence[DetectorRule] = fw.get("some", [])

    if not every and not some:
        return False

    every_pass = all(
        _rule_matches(r, root_files, file_contents, package_manifest, root_dirs) for r in every
    )
    some_pass = (
        any(_rule_matches(r, root_files, file_contents, package_manifest, root_dirs) for r in some)
        if some
        else True
    )

    return every_pass and some_pass


def _apply_supersession(results: list[DetectedPlatform]) -> list[DetectedPlatform]:
    """Remove platforms superseded by more specific ones.

    Non-selectable platforms are excluded from superseding because they will
    be filtered out later, which would drop valid detections.
    """
    detected = {r["platform"] for r in results}
    selectable = detected - _NON_SELECTABLE_PLATFORMS
    superseded = {child for pid in selectable for child in _SUPERSESSION_MAP.get(pid, [])}
    return [r for r in results if r["platform"] not in superseded]
