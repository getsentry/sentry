from __future__ import annotations

import logging
import re
from base64 import b64decode
from collections import defaultdict
from collections.abc import Sequence
from typing import TYPE_CHECKING, NotRequired, TypedDict

from sentry.shared_integrations.exceptions import ApiError
from sentry.utils import json
from sentry.utils.yaml import safe_load

if TYPE_CHECKING:
    from sentry.integrations.github.client import GitHubBaseClient

logger = logging.getLogger(__name__)

# GitHub Linguist name → Sentry base platform ID
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


# Each framework is a self-contained definition with composable detector rules.
#
# The `sort` field controls priority within a language group for onboarding.
# Lower sort = higher priority. Converted to `priority = 100 - sort` in output.
# Across languages, byte count (language majority) is the primary ranking factor.
#
#   sort=1      Meta / cross-platform   Next.js, Remix, React Native, Electron, Flutter
#   sort=10     Primary frameworks      Django, Rails, React, Vue, Angular, Spring Boot
#   sort=20     Secondary frameworks    Flask, Express, Go frameworks, PHP Symfony
#   sort=30     Niche frameworks        Starlette, Tornado, Bottle, Rack
#   sort=50     Serverless / edge       AWS Lambda, GCP Functions, Cloudflare Workers
#   sort=60     Utilities / runtimes    Celery, RQ, Log4j, Node, Bun, Deno
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
            {"path": "local.settings.json"},
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
    # --- Node.js base (sort=60, low priority fallback) ---
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
    # Go — using full module paths for precise matching
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
    # Dart / Flutter (requires pubspec.yaml manifest parsing)
    # ===================================================================
    {
        "platform": "flutter",
        "sort": 1,
        "base_platform": "dart",
        "some": [{"match_package": "flutter"}],
    },
    # ===================================================================
    # Swift — iOS vs macOS differentiation
    # ===================================================================
    {
        "platform": "apple-ios",
        "sort": 10,
        "base_platform": "swift",
        "some": [
            {"path": "Package.swift", "match_content": r"\.iOS\s*\("},
            {"path": "Podfile", "match_content": r"platform\s*:ios\b"},
            {"match_ext": ".xcodeproj"},
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
    # Native (C/C++) — Qt framework detection
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
    # Mobile / Desktop / Gaming — directory and extension-based detection
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
    # JavaScript runtimes (sort=60, low priority — these are runtimes, not frameworks)
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
    # .NET variants — detected via .csproj content inspection
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

# Derived indexes built at module load
_FRAMEWORKS_BY_PLATFORM: dict[str, list[FrameworkDef]] = defaultdict(list)
for _fw in FRAMEWORKS:
    _FRAMEWORKS_BY_PLATFORM[_fw["base_platform"]].append(_fw)

_SUPERSESSION_MAP: dict[str, list[str]] = {}
for _fw in FRAMEWORKS:
    if "supersedes" in _fw:
        _SUPERSESSION_MAP[_fw["platform"]] = _fw["supersedes"]

# Platforms that are detected internally (as base platforms for framework
# detection) but are not selectable in the frontend project creation picker.
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
    "go": "go.mod",
}


class _PackageManifest(TypedDict):
    dependencies: set[str]
    dev_dependencies: set[str]


def _ref_params(ref: str | None) -> dict[str, str]:
    return {"ref": ref} if ref else {}


def _get_repo_file_content(
    client: GitHubBaseClient, repo: str, path: str, ref: str | None = None
) -> str | None:
    """Fetch a file's content from a GitHub repo. Returns None if not found."""
    try:
        response = client.get(
            f"/repos/{repo}/contents/{path}",
            params=_ref_params(ref),
        )
        return b64decode(response["content"]).decode("utf-8")
    except (ApiError, KeyError, TypeError, UnicodeDecodeError, ValueError):
        return None


def _get_root_entries(
    client: GitHubBaseClient, repo: str, ref: str | None = None
) -> tuple[set[str] | None, set[str] | None]:
    """Fetch the root-level file and directory names in a single API call.

    Returns (None, None) on API failure so callers can fall back to
    fetching files individually rather than assuming the repo root is empty.
    """
    try:
        response = client.get(f"/repos/{repo}/contents", params=_ref_params(ref))
        files = {item["name"] for item in response if item.get("type") == "file" and "name" in item}
        dirs = {item["name"] for item in response if item.get("type") == "dir" and "name" in item}
        return files, dirs
    except (ApiError, AttributeError, TypeError):
        return None, None


def _parse_package_manifest(content: str, manifest_file: str) -> _PackageManifest | None:
    """Parse a package manifest into dependency sets."""
    try:
        if manifest_file == "package.json":
            pkg = json.loads(content)
            return _PackageManifest(
                dependencies=set((pkg.get("dependencies") or {}).keys()),
                dev_dependencies=set((pkg.get("devDependencies") or {}).keys()),
            )
        elif manifest_file == "composer.json":
            composer = json.loads(content)
            return _PackageManifest(
                dependencies=set((composer.get("require") or {}).keys()),
                dev_dependencies=set((composer.get("require-dev") or {}).keys()),
            )
        elif manifest_file == "pubspec.yaml":
            return _parse_pubspec_yaml(content)
        elif manifest_file == "Gemfile":
            return _parse_gemfile(content)
        elif manifest_file == "go.mod":
            return _parse_go_mod(content)
    except Exception:
        pass
    return None


def _parse_pubspec_yaml(content: str) -> _PackageManifest:
    """Parse a pubspec.yaml file into dependency sets using PyYAML."""
    data = safe_load(content)
    if not isinstance(data, dict):
        return _PackageManifest(dependencies=set(), dev_dependencies=set())
    deps = set((data.get("dependencies") or {}).keys())
    dev_deps = set((data.get("dev_dependencies") or {}).keys())
    return _PackageManifest(dependencies=deps, dev_dependencies=dev_deps)


def _parse_gemfile(content: str) -> _PackageManifest:
    """Parse a Gemfile into dependency sets.

    Extracts gem names from ``gem "name"`` or ``gem 'name'`` lines.
    """
    deps: set[str] = set()
    gem_re = re.compile(r"""gem\s+['"]([^'"]+)['"]""")
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue
        match = gem_re.search(stripped)
        if match:
            deps.add(match.group(1))
    return _PackageManifest(dependencies=deps, dev_dependencies=set())


def _parse_go_mod(content: str) -> _PackageManifest:
    """Parse a go.mod file into dependency sets.

    Extracts module paths from ``require`` directives, both single-line
    (``require path v1.0``) and block form (``require ( ... )``).
    """
    deps: set[str] = set()
    in_require = False
    for line in content.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("//"):
            continue
        if stripped.startswith("require ("):
            in_require = True
            continue
        if in_require:
            if stripped == ")":
                in_require = False
                continue
            parts = stripped.split()
            if parts:
                deps.add(parts[0])
        elif stripped.startswith("require "):
            parts = stripped.split()
            if len(parts) >= 2:
                deps.add(parts[1])
    return _PackageManifest(dependencies=deps, dev_dependencies=set())


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
    # Go module version path matching: github.com/foo/bar matches github.com/foo/bar/v2
    # Only applies to Go module paths (contain a dot from the domain name),
    # not npm scoped packages (@nestjs/core) or composer packages (laravel/framework).
    if "." in package_name and "/" in package_name:
        version_prefix = package_name + "/v"
        return any(
            dep.startswith(version_prefix)
            and len(dep) > len(version_prefix)
            and dep[len(version_prefix)].isdigit()
            for dep in all_deps
        )
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
        # match_ext + match_content: search content of extension-matched files
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

    # path-only rule: check if file exists in root
    # When root_files is None (API failed), we can't confirm existence
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
    """Remove platforms that are superseded by more specific ones.

    e.g. if Next.js is detected, React is redundant since Next.js includes it.
    """
    detected = {r["platform"] for r in results}
    superseded = {child for pid in detected for child in _SUPERSESSION_MAP.get(pid, [])}
    return [r for r in results if r["platform"] not in superseded]


def detect_platforms(
    client: GitHubBaseClient,
    repo: str,
    ref: str | None = None,
) -> list[DetectedPlatform]:
    """
    Detect Sentry platforms for a GitHub repository.

    Uses composable framework definitions with five signal types:
    1. Config files — path-only rules (next.config.js, manage.py, etc.)
    2. Manifest content — path + match_content rules (requirements.txt, go.mod, etc.)
    3. Package dependencies — match_package rules (package.json, composer.json, etc.)
    4. Root directories — match_dir rules (Assets/, app/, etc.)
    5. File extensions — match_ext rules (.csproj, .uproject, etc.)

    Results are ranked by bytes (descending), then priority (descending).
    Superseded frameworks (e.g. React when Next.js is present) are removed.
    """
    languages = client.get_languages(repo)
    root_files, root_dirs = _get_root_entries(client, repo, ref)

    # Find the top language and only process its base platform to limit
    # API calls — only one suggestion is shown to the user anyway.
    top_language: str | None = None
    top_bytes = 0
    for language, byte_count in languages.items():
        if language in IGNORED_LANGUAGES:
            continue
        if GITHUB_LANGUAGE_TO_SENTRY_PLATFORM.get(language) is not None and byte_count > top_bytes:
            top_language = language
            top_bytes = byte_count

    active_platforms: dict[str, list[tuple[str, int]]] = {}
    if top_language is not None:
        bp = GITHUB_LANGUAGE_TO_SENTRY_PLATFORM[top_language]
        active_platforms[bp] = [(top_language, top_bytes)]

    # Collect all file paths that need content fetching.
    # When root_files is None (API failed), try all paths rather than skipping.
    needed_paths: set[str] = set()
    for base_platform in active_platforms:
        # Include manifest files for match_package rules
        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        if manifest_file and (root_files is None or manifest_file in root_files):
            needed_paths.add(manifest_file)
        # Include files for match_content rules
        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            for rule in [*fw.get("every", []), *fw.get("some", [])]:
                if "match_content" not in rule:
                    continue
                path = rule.get("path")
                if path:
                    if root_files is None or path in root_files:
                        needed_paths.add(path)
                elif "match_ext" in rule and root_files is not None:
                    ext = rule["match_ext"]
                    for f in root_files:
                        if f.endswith(ext):
                            needed_paths.add(f)

    # Fetch file contents in one pass
    file_contents: dict[str, str] = {}
    for path in needed_paths:
        content = _get_repo_file_content(client, repo, path, ref)
        if content is not None:
            file_contents[path] = content

    # Parse package manifests for platforms that use match_package rules
    package_manifests: dict[str, _PackageManifest | None] = {}
    for base_platform in active_platforms:
        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        if manifest_file is None or manifest_file in package_manifests:
            continue
        if root_files is not None and manifest_file not in root_files:
            package_manifests[manifest_file] = None
            continue
        content = file_contents.get(manifest_file)
        package_manifests[manifest_file] = (
            _parse_package_manifest(content, manifest_file) if content else None
        )

    # Evaluate frameworks per base platform
    results: list[DetectedPlatform] = []
    seen_platforms: set[str] = set()

    for base_platform, lang_entries in active_platforms.items():
        language, byte_count = max(lang_entries, key=lambda x: x[1])

        manifest_file = _PACKAGE_MANIFEST_FILES.get(base_platform)
        manifest = package_manifests.get(manifest_file) if manifest_file else None

        for fw in _FRAMEWORKS_BY_PLATFORM.get(base_platform, []):
            if _framework_matches(fw, root_files, file_contents, manifest, root_dirs):
                platform_id = fw["platform"]
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
    results.sort(key=lambda r: (r["bytes"], r["priority"]), reverse=True)

    return results
