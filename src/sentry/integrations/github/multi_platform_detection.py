from __future__ import annotations

import re
import time
from collections import defaultdict
from collections.abc import Sequence
from typing import TYPE_CHECKING, NotRequired, TypedDict

import sentry_sdk

if TYPE_CHECKING:
    from sentry.integrations.github.client import GitHubBaseClient

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


# ---------------------------------------------------------------------------
# Framework definitions
#
# sort tiers:
#   sort=1   Meta / cross-platform   Next.js, Remix, React Native, Flutter
#   sort=10  Primary frameworks      Django, Rails, React, Vue, Spring Boot
#   sort=20  Secondary frameworks    Flask, Express, Go frameworks, Symfony
#   sort=30  Niche frameworks        Starlette, Tornado, Rack
#   sort=50  Serverless / edge       AWS Lambda, GCP Functions, CF Workers
#   sort=60  Utilities / runtimes    Celery, RQ, Log4j, Node, Bun, Deno
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
    # --- Mobile / cross-platform (sort=1) ---
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
# Core rule-matching functions (ported verbatim from platform_detection.py)
# ---------------------------------------------------------------------------


class _PackageManifest(TypedDict):
    dependencies: set[str]
    dev_dependencies: set[str]


def _rule_matches(
    rule: DetectorRule,
    root_files: set[str] | None,
    file_contents: dict[str, str],
    package_manifest: _PackageManifest | None,
    root_dirs: set[str] | None = None,
) -> bool:
    """Evaluate a single detector rule against repository state."""
    if "match_package" in rule:
        if package_manifest is None:
            return False
        all_deps = package_manifest["dependencies"] | package_manifest["dev_dependencies"]
        pkg = rule["match_package"]
        if pkg in all_deps:
            return True
        if pkg.endswith("/"):
            return any(dep.startswith(pkg) for dep in all_deps)
        return False

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


# ---------------------------------------------------------------------------
# Multi-platform detection constants
# ---------------------------------------------------------------------------

# Max number of languages (by byte count) to evaluate in a single detection
# run. Fixed at 3 for this pass; revisit once we have a few days of
# languages_count / k_candidate metrics.
MAX_LANGUAGES = 3

# Sort key weight for confidence tier: high > medium > low.
# Ensures a framework match (high) always ranks above a bare-language fallback
# (medium) regardless of byte count.
_CONFIDENCE_ORDER: dict[str, int] = {"high": 2, "medium": 1, "low": 0}

# Metric namespace — shared with the measurement endpoint so all multi-detector
# signals land in the same namespace.
_MULTI_METRICS_PREFIX = "onboarding-scm.platform_detection.multi"


def _count_language_groups(languages: dict[str, int]) -> int:
    """Count the distinct mapped Sentry base platforms across a repo's languages.

    SDK-less languages are ignored and related languages collapse to a single
    base platform (e.g. TypeScript + JavaScript -> javascript).
    """
    groups: set[str] = set()
    for language in languages:
        if language in IGNORED_LANGUAGES:
            continue
        bp = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if bp is not None:
            groups.add(bp)
    return len(groups)


def _select_active_platforms(
    languages: dict[str, int],
) -> dict[str, list[tuple[str, int]]]:
    """Return the top-N mapped base platforms sorted by byte count descending.

    Multiple GitHub languages can map to the same Sentry base platform
    (e.g. TypeScript + JavaScript → javascript). When that happens both
    contribute to the same bucket.
    """
    active_platforms: dict[str, list[tuple[str, int]]] = defaultdict(list)
    count = 0
    for language, byte_count in sorted(languages.items(), key=lambda x: x[1], reverse=True):
        if language in IGNORED_LANGUAGES:
            continue
        base_platform = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language)
        if base_platform is not None:
            if base_platform not in active_platforms:
                # Only count new base platforms toward the cap; related
                # languages (e.g. TS after JS) are grouped for free.
                count += 1
                if count > MAX_LANGUAGES:
                    break
            active_platforms[base_platform].append((language, byte_count))
    return dict(active_platforms)


# ---------------------------------------------------------------------------
# Noise-scoping ignore-list for recursive tree traversal
#
# Based on GitHub Linguist's vendor.yml (https://github.com/github/linguist/
# blob/master/lib/linguist/vendor.yml) — the list GitHub uses to exclude
# third-party/generated paths from repository language statistics. Sentry has
# no canonical equivalent; the closest is the JS stacktrace folder regex in
# sentry/src/sentry/lang/javascript/utils.py.
#
# Matching is done on individual path segments (split on "/"), not substring,
# so a file named "build.gradle" is never confused with a "build/" directory.
#
# Deliberately NOT ignored:
#   packages/   — JS monorepo workspaces (the thing we want to detect)
#   test/       — often contain real framework signals
#   tests/      — same
#   examples/   — borderline; revisit if Mode A shows false positives
# ---------------------------------------------------------------------------

_IGNORED_TREE_SEGMENTS = frozenset(
    {
        # JS / front-end dependency directories
        "node_modules",
        "bower_components",
        "jspm_packages",
        "web_modules",
        # General vendored dependencies
        "vendor",
        "vendors",
        "third_party",
        "third-party",
        "3rdparty",
        "extern",
        "external",
        # iOS / macOS dependency managers
        "Pods",
        "Carthage",
        # Dart / Flutter tooling
        ".dart_tool",
        ".pub-cache",
        # Python virtual environments committed to repo
        "site-packages",
        ".venv",
        "venv",
        "virtualenv",
        # Build / compiled output
        "dist",
        "build",
        "out",
        "target",
        "bin",
        "obj",
        # Framework-specific build caches
        ".next",
        ".nuxt",
        ".svelte-kit",
        ".angular",
        ".output",
        "__pycache__",
        "coverage",
        # VCS internals
        ".git",
        ".svn",
        ".hg",
        # Tooling / IDE / cache
        ".gradle",
        ".idea",
        ".vscode",
        ".cache",
        ".tox",
        ".mypy_cache",
        ".pytest_cache",
        "tmp",
        "temp",
    }
)


def _path_is_ignored(path: str) -> bool:
    """Return True if any segment of the path is in the ignore-list."""
    return any(segment in _IGNORED_TREE_SEGMENTS for segment in path.split("/"))


def _get_tree(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> tuple[list[dict], bool]:
    """Fetch the full recursive git tree for a repo.

    Uses raw client.get() rather than client.get_tree() so that the
    ``truncated`` flag and per-entry ``size`` fields are preserved.
    Returns (entries, is_truncated).
    """
    response = client.get(
        f"/repos/{repo}/git/trees/{ref or 'HEAD'}",
        params={"recursive": 1},
    )
    if not isinstance(response, dict):
        return [], False
    entries: list[dict] = response.get("tree", []) or []
    is_truncated = bool(response.get("truncated"))
    return entries, is_truncated


class _TreeIndex:
    """Indexed view of a repository's recursive git tree."""

    def __init__(
        self,
        files: set[str],
        dirs: set[str],
        repo_size_bytes: int,
    ) -> None:
        self.files = files
        self.dirs = dirs
        self.repo_size_bytes = repo_size_bytes


def _build_tree_index(entries: list[dict]) -> _TreeIndex:
    """Build a searchable index from raw git tree entries.

    Blobs (files) and trees (directories) are indexed by their basename.
    Any entry whose path passes through an ignored segment is skipped, so
    ``node_modules/some-lib/package.json`` never contributes a false signal.
    ``repo_size_bytes`` is the sum of ``size`` across all non-ignored blobs.
    """
    files: set[str] = set()
    dirs: set[str] = set()
    repo_size_bytes = 0

    for entry in entries:
        path = entry.get("path", "")
        if not path or _path_is_ignored(path):
            continue

        entry_type = entry.get("type")
        basename = path.rsplit("/", 1)[-1]

        if entry_type == "blob":
            files.add(basename)
            repo_size_bytes += entry.get("size") or 0
        elif entry_type == "tree":
            dirs.add(basename)

    return _TreeIndex(files=files, dirs=dirs, repo_size_bytes=repo_size_bytes)


class MultiDetectionResult(TypedDict):
    """Return value of detect_platforms_multi.

    ``platforms`` is the product output — what a future live endpoint surfaces.
    The remaining fields are measurement scaffolding (temporary): they feed the
    Mode A harness and drive the Sentry metrics that size K_candidate thresholds
    and truncation rates. Remove them once those thresholds are set and the
    measurement-only endpoint is retired (see multiPlatformPlan.md).
    """

    platforms: list[DetectedPlatform]
    k_candidate: int  # how many content-reads would be needed to resolve content/package rules
    needed_paths: set[str]  # the actual filenames (measurement scaffolding)
    tree_entry_count: int  # total entries returned by GitHub
    is_truncated: bool  # GitHub truncated the tree at 100k entries / 7MB
    repo_size_bytes: int  # sum of blob sizes across the whole tree


def _collect_needed_paths(
    active_platforms: dict[str, list[tuple[str, int]]],
    tree_files: set[str],
) -> set[str]:
    """Collect the file paths that content/package rules would need to fetch.

    For each active base platform:
    - If a package manifest exists in the tree, include it (covers match_package rules).
    - For every framework rule that has match_content, include the target path if it
      exists in the tree. For match_ext rules with match_content, include every
      matching-extension file found in the tree.

    The ignore-list is already applied upstream (tree_files contains only
    non-ignored basenames), so no extra filtering is needed here.
    """
    needed: set[str] = set()

    for base_platform in active_platforms:
        # Package manifest for match_package rules
        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        if manifest_file and manifest_file in tree_files:
            needed.add(manifest_file)

        # Files required by match_content rules
        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" not in rule:
                    continue
                path = rule.get("path")
                if path:
                    if path in tree_files:
                        needed.add(path)
                elif "match_ext" in rule:
                    ext = rule["match_ext"]
                    for f in tree_files:
                        if f.endswith(ext):
                            needed.add(f)

    return needed


def detect_platforms_multi(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> MultiDetectionResult:
    """Detect Sentry platforms for a GitHub repository.

    Selects up to MAX_LANGUAGES base platforms by byte count, fetches the
    full recursive git tree once, and evaluates existence rules (path /
    match_dir / match_ext) across all paths — subdir-aware with no extra API
    calls. Content/package rules (match_content / match_package) are not
    evaluated here; the paths they would need are counted as k_candidate
    without fetching them.

    The return value feeds the Mode A harness and (eventually) the live
    detection endpoint.
    """
    start_time = time.monotonic()

    languages: dict[str, int] = client.get_languages(repo)
    active_platforms = _select_active_platforms(languages)

    entries, is_truncated = _get_tree(client, repo, ref)
    index = _build_tree_index(entries)

    results: list[DetectedPlatform] = []
    seen_platforms: set[str] = set()

    for base_platform, lang_entries in active_platforms.items():
        language, byte_count = max(lang_entries, key=lambda x: x[1])

        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            # Pass empty file_contents and no manifest so only path/dir/ext
            # existence rules fire; content/package rules return False here.
            if _framework_matches(fw, index.files, {}, None, index.dirs):
                platform_id = fw["platform"]
                if platform_id not in seen_platforms:
                    seen_platforms.add(platform_id)
                    results.append(
                        DetectedPlatform(
                            platform=platform_id,
                            language=language,
                            bytes=byte_count,
                            confidence="high",
                            priority=100 - fw["sort"],
                        )
                    )

        if base_platform not in seen_platforms:
            seen_platforms.add(base_platform)
            results.append(
                DetectedPlatform(
                    platform=base_platform,
                    language=language,
                    bytes=byte_count,
                    confidence="medium",
                    priority=1,
                )
            )

    results = _apply_supersession(results)
    results = [r for r in results if r["platform"] not in _NON_SELECTABLE_PLATFORMS]
    results.sort(
        key=lambda r: (_CONFIDENCE_ORDER[r["confidence"]], r["bytes"], r["priority"]),
        reverse=True,
    )

    needed_paths = _collect_needed_paths(active_platforms, index.files)

    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.duration",
        (time.monotonic() - start_time) * 1000,
        unit="millisecond",
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.tree.entry_count",
        len(entries),
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.repo_size_bytes",
        index.repo_size_bytes,
        unit="byte",
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.languages_count",
        _count_language_groups(languages),
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.detected_platforms_count",
        len(results),
    )
    sentry_sdk.metrics.distribution(
        f"{_MULTI_METRICS_PREFIX}.k_reads_needed",
        len(needed_paths),
    )
    sentry_sdk.metrics.count(
        f"{_MULTI_METRICS_PREFIX}.completed",
        1,
        attributes={
            "is_truncated": is_truncated,
            "confidence": results[0]["confidence"] if results else "none",
            "has_framework": any(r["confidence"] == "high" for r in results),
        },
    )

    return MultiDetectionResult(
        platforms=results,
        k_candidate=len(needed_paths),
        needed_paths=needed_paths,
        tree_entry_count=len(entries),
        is_truncated=is_truncated,
        repo_size_bytes=index.repo_size_bytes,
    )
