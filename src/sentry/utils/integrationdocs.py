from __future__ import annotations

import concurrent.futures

# Import the stdlib json instead of sentry.utils.json, since this command is
# run at build time
import json  # noqa: S003
import logging
import multiprocessing
import os
import sys
import time
from typing import IO, Any, TypedDict
from urllib.request import urlopen

import sentry

# NOTE: This is run external to sentry as well as part of the setup
# process.  Thus we do not want to import non stdlib things here.


class Integration(TypedDict):
    key: str
    type: str
    details: str
    doc_link: str
    name: str
    aliases: list[str]
    categories: list[str]


class Platform(TypedDict):
    id: str
    name: str
    integrations: list[dict[str, str]]


INTEGRATION_DOCS_URL = os.environ.get("INTEGRATION_DOCS_URL", "https://docs.sentry.io/_platforms/")
BASE_URL = INTEGRATION_DOCS_URL + "{}"

# Also see INTEGRATION_DOC_FOLDER in setup.py
DOC_FOLDER = os.environ.get("INTEGRATION_DOC_FOLDER") or os.path.abspath(
    os.path.join(os.path.dirname(sentry.__file__), "integration-docs")
)


class SuspiciousDocPathOperation(Exception):
    """A suspicious operation was attempted while accessing the doc path"""


"""
Looking to add a new framework/language to /settings/install?

In the appropriate client SDK repository (e.g. raven-js), edit docs/sentry-doc-config.json.
Add the new language/framework.

Example: https://github.com/getsentry/raven-js/blob/master/docs/sentry-doc-config.json

Once the docs have been deployed, you can run `sentry repair --with-docs` to pull down
the latest list of integrations and serve them in your local Sentry install.
"""

logger = logging.getLogger("sentry")


def echo(what: str) -> None:
    sys.stdout.write(what + "\n")
    sys.stdout.flush()


def dump_doc(path: str, data: dict[str, Any]) -> None:
    expected_commonpath = os.path.realpath(DOC_FOLDER)
    doc_path = os.path.join(DOC_FOLDER, f"{path}.json")
    doc_real_path = os.path.realpath(doc_path)

    if expected_commonpath != os.path.commonpath([expected_commonpath, doc_real_path]):
        raise SuspiciousDocPathOperation("illegal path access")

    directory = os.path.dirname(doc_path)
    try:
        os.makedirs(directory)
    except OSError:
        pass
    with open(doc_path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, indent=2))
        f.write("\n")


def load_doc(path: str) -> dict[str, Any] | None:
    expected_commonpath = os.path.realpath(DOC_FOLDER)
    doc_path = os.path.join(DOC_FOLDER, f"{path}.json")
    doc_real_path = os.path.realpath(doc_path)

    if expected_commonpath != os.path.commonpath([expected_commonpath, doc_real_path]):
        raise SuspiciousDocPathOperation("illegal path access")

    try:
        with open(doc_path, encoding="utf-8") as f:
            return json.load(f)  # type: ignore[no-any-return]
    except OSError:
        return None


def get_integration_id(platform_id: str, integration_id: str) -> str:
    if integration_id == "_self":
        return platform_id
    return f"{platform_id}-{integration_id}"


def urlopen_with_retries(url: str, timeout: int = 5, retries: int = 10) -> IO[bytes]:
    for i in range(retries):
        try:
            return urlopen(url, timeout=timeout)  # type: ignore
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(i * 0.01)
    else:
        raise AssertionError("unreachable")


def sync_docs(quiet: bool = False) -> None:
    if not quiet:
        echo("syncing documentation (platform index)")
    data: dict[str, dict[str, dict[str, Integration]]]
    # data = json.load(urlopen_with_retries(BASE_URL.format("_index.json")))
    data = {
        "platforms": {
            "unreal": {
                "_self": {
                    "key": "unreal",
                    "type": "framework",
                    "details": "unreal.json",
                    "doc_link": "https://docs.sentry.io/platforms/unreal/",
                    "name": "Unreal Engine",
                    "aliases": [],
                    "categories": ["mobile", "desktop", "console", "gaming"],
                }
            },
            "unity": {
                "_self": {
                    "key": "unity",
                    "type": "framework",
                    "details": "unity.json",
                    "doc_link": "https://docs.sentry.io/platforms/unity/",
                    "name": "Unity",
                    "aliases": [],
                    "categories": ["mobile", "browser", "desktop", "console", "gaming"],
                }
            },
            "rust": {
                "_self": {
                    "key": "rust",
                    "type": "language",
                    "details": "rust.json",
                    "doc_link": "https://docs.sentry.io/platforms/rust/",
                    "name": "Rust",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-0-alert": {
                    "key": "rust.profiling-onboarding-0-alert",
                    "type": "language",
                    "details": "rust/profiling-onboarding-0-alert.json",
                    "doc_link": "https://docs.sentry.io/platforms/rust/profiling/",
                    "name": "Rust",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-1-install": {
                    "key": "rust.profiling-onboarding-1-install",
                    "type": "language",
                    "details": "rust/profiling-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/rust/profiling/",
                    "name": "Rust",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-2-configure-performance": {
                    "key": "rust.profiling-onboarding-2-configure-performance",
                    "type": "language",
                    "details": "rust/profiling-onboarding-2-configure-performance.json",
                    "doc_link": "https://docs.sentry.io/platforms/rust/profiling/",
                    "name": "Rust",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-3-configure-profiling": {
                    "key": "rust.profiling-onboarding-3-configure-profiling",
                    "type": "language",
                    "details": "rust/profiling-onboarding-3-configure-profiling.json",
                    "doc_link": "https://docs.sentry.io/platforms/rust/profiling/",
                    "name": "Rust",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-4-upload": {
                    "key": "rust.profiling-onboarding-4-upload",
                    "type": "language",
                    "details": "rust/profiling-onboarding-4-upload.json",
                    "doc_link": "https://docs.sentry.io/platforms/rust/profiling/",
                    "name": "Rust",
                    "aliases": [],
                    "categories": [],
                },
            },
            "ruby": {
                "_self": {
                    "key": "ruby",
                    "type": "language",
                    "details": "ruby.json",
                    "doc_link": "https://docs.sentry.io/platforms/ruby/",
                    "name": "Ruby",
                    "aliases": [],
                    "categories": [],
                },
                "rack": {
                    "key": "ruby.rack",
                    "type": "framework",
                    "details": "ruby/rack.json",
                    "doc_link": "https://docs.sentry.io/platforms/ruby/guides/rack/",
                    "name": "Rack Middleware",
                    "aliases": [],
                    "categories": [],
                },
                "rails": {
                    "key": "ruby.rails",
                    "type": "framework",
                    "details": "ruby/rails.json",
                    "doc_link": "https://docs.sentry.io/platforms/ruby/guides/rails/",
                    "name": "Rails",
                    "aliases": [],
                    "categories": [],
                },
            },
            "react-native": {
                "_self": {
                    "key": "react-native",
                    "type": "language",
                    "details": "react-native.json",
                    "doc_link": "https://docs.sentry.io/platforms/react-native/",
                    "name": "React Native",
                    "aliases": [],
                    "categories": ["mobile"],
                },
                "tracing": {
                    "key": "react-native.tracing",
                    "type": "language",
                    "details": "react-native/tracing.json",
                    "doc_link": "https://docs.sentry.io/platforms/react-native/performance/",
                    "name": "React-Native",
                    "aliases": [],
                    "categories": [],
                },
            },
            "python": {
                "aiohttp": {
                    "key": "python.aiohttp",
                    "type": "framework",
                    "details": "python/aiohttp.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/aiohttp/",
                    "name": "AIOHTTP",
                    "aliases": [],
                    "categories": [],
                },
                "asgi": {
                    "key": "python.asgi",
                    "type": "framework",
                    "details": "python/asgi.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/asgi/",
                    "name": "ASGI",
                    "aliases": [],
                    "categories": [],
                },
                "awslambda": {
                    "key": "python.awslambda",
                    "type": "framework",
                    "details": "python/awslambda.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/aws-lambda/",
                    "name": "AWS Lambda (Python)",
                    "aliases": [],
                    "categories": [],
                },
                "bottle": {
                    "key": "python.bottle",
                    "type": "framework",
                    "details": "python/bottle.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/bottle/",
                    "name": "Bottle",
                    "aliases": [],
                    "categories": [],
                },
                "celery": {
                    "key": "python.celery",
                    "type": "library",
                    "details": "python/celery.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/celery/",
                    "name": "Celery",
                    "aliases": [],
                    "categories": [],
                },
                "chalice": {
                    "key": "python.chalice",
                    "type": "framework",
                    "details": "python/chalice.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/chalice/",
                    "name": "Chalice",
                    "aliases": [],
                    "categories": [],
                },
                "django": {
                    "key": "python.django",
                    "type": "framework",
                    "details": "python/django.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/django/",
                    "name": "Django",
                    "aliases": [],
                    "categories": [],
                },
                "falcon": {
                    "key": "python.falcon",
                    "type": "framework",
                    "details": "python/falcon.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/falcon/",
                    "name": "Falcon",
                    "aliases": [],
                    "categories": [],
                },
                "fastapi": {
                    "key": "python.fastapi",
                    "type": "framework",
                    "details": "python/fastapi.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/fastapi/",
                    "name": "FastAPI",
                    "aliases": [],
                    "categories": [],
                },
                "flask": {
                    "key": "python.flask",
                    "type": "framework",
                    "details": "python/flask.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/flask/",
                    "name": "Flask",
                    "aliases": [],
                    "categories": [],
                },
                "gcpfunctions": {
                    "key": "python.gcpfunctions",
                    "type": "framework",
                    "details": "python/gcpfunctions.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/gcp-functions/",
                    "name": "Google Cloud Functions (Python)",
                    "aliases": [],
                    "categories": [],
                },
                "_self": {
                    "key": "python",
                    "type": "language",
                    "details": "python.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/",
                    "name": "Python",
                    "aliases": [],
                    "categories": [],
                },
                "pylons": {
                    "key": "python.pylons",
                    "type": "framework",
                    "details": "python/pylons.json",
                    "doc_link": "https://docs.sentry.io/clients/python/integrations/pylons/",
                    "name": "Pylons",
                    "aliases": [],
                    "categories": [],
                },
                "pymongo": {
                    "key": "python.pymongo",
                    "type": "library",
                    "details": "python/pymongo.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/pymongo/",
                    "name": "PyMongo",
                    "aliases": [],
                    "categories": [],
                },
                "pyramid": {
                    "key": "python.pyramid",
                    "type": "framework",
                    "details": "python/pyramid.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/pyramid/",
                    "name": "Pyramid",
                    "aliases": [],
                    "categories": [],
                },
                "quart": {
                    "key": "python.quart",
                    "type": "framework",
                    "details": "python/quart.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/quart/",
                    "name": "Quart",
                    "aliases": [],
                    "categories": [],
                },
                "rq": {
                    "key": "python.rq",
                    "type": "library",
                    "details": "python/rq.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/rq/",
                    "name": "RQ (Redis Queue)",
                    "aliases": [],
                    "categories": [],
                },
                "sanic": {
                    "key": "python.sanic",
                    "type": "framework",
                    "details": "python/sanic.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/sanic/",
                    "name": "Sanic",
                    "aliases": [],
                    "categories": [],
                },
                "serverless": {
                    "key": "python.serverless",
                    "type": "framework",
                    "details": "python/serverless.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/serverless/",
                    "name": "Serverless",
                    "aliases": [],
                    "categories": [],
                },
                "starlette": {
                    "key": "python.starlette",
                    "type": "framework",
                    "details": "python/starlette.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/starlette/",
                    "name": "Starlette",
                    "aliases": [],
                    "categories": [],
                },
                "tornado": {
                    "key": "python.tornado",
                    "type": "framework",
                    "details": "python/tornado.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/tornado/",
                    "name": "Tornado",
                    "aliases": [],
                    "categories": [],
                },
                "tracing": {
                    "key": "python.tracing",
                    "type": "language",
                    "details": "python/tracing.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/performance/",
                    "name": "Python",
                    "aliases": [],
                    "categories": [],
                },
                "tryton": {
                    "key": "python.tryton",
                    "type": "framework",
                    "details": "python/tryton.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/tryton/",
                    "name": "Tryton",
                    "aliases": [],
                    "categories": [],
                },
                "wsgi": {
                    "key": "python.wsgi",
                    "type": "framework",
                    "details": "python/wsgi.json",
                    "doc_link": "https://docs.sentry.io/platforms/python/guides/wsgi/",
                    "name": "WSGI",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-0-alert": {
                    "key": "python.profiling-onboarding-0-alert",
                    "type": "language",
                    "details": "python/profiling-onboarding-0-alert.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Python",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-1-install": {
                    "key": "python.profiling-onboarding-1-install",
                    "type": "language",
                    "details": "python/profiling-onboarding-1-install.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Python",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-2-configure-performance": {
                    "key": "python.profiling-onboarding-2-configure-performance",
                    "type": "language",
                    "details": "python/profiling-onboarding-2-configure-performance.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Python",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-3-configure-profiling": {
                    "key": "python.profiling-onboarding-3-configure-profiling",
                    "type": "language",
                    "details": "python/profiling-onboarding-3-configure-profiling.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Python",
                    "aliases": [],
                    "categories": [],
                },
            },
            "php": {
                "_self": {
                    "key": "php",
                    "type": "language",
                    "details": "php.json",
                    "doc_link": "https://docs.sentry.io/platforms/php/",
                    "name": "PHP",
                    "aliases": [],
                    "categories": [],
                },
                "laravel": {
                    "key": "php.laravel",
                    "type": "framework",
                    "details": "php/laravel.json",
                    "doc_link": "https://docs.sentry.io/platforms/php/guides/laravel/",
                    "name": "Laravel",
                    "aliases": [],
                    "categories": [],
                },
                "symfony": {
                    "key": "php.symfony",
                    "type": "framework",
                    "details": "php/symfony.json",
                    "doc_link": "https://docs.sentry.io/platforms/php/guides/symfony/",
                    "name": "Symfony",
                    "aliases": [],
                    "categories": [],
                },
            },
            "node": {
                "awslambda": {
                    "key": "node.awslambda",
                    "type": "framework",
                    "details": "node/awslambda.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/aws-lambda/",
                    "name": "AWS Lambda (Node)",
                    "aliases": [],
                    "categories": [],
                },
                "azurefunctions": {
                    "key": "node.azurefunctions",
                    "type": "framework",
                    "details": "node/azurefunctions.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/azure-functions/",
                    "name": "Azure Functions (Node)",
                    "aliases": [],
                    "categories": [],
                },
                "connect": {
                    "key": "node.connect",
                    "type": "framework",
                    "details": "node/connect.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/connect/",
                    "name": "Connect",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "express": {
                    "key": "node.express",
                    "type": "framework",
                    "details": "node/express.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/express/",
                    "name": "Express",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "gcpfunctions": {
                    "key": "node.gcpfunctions",
                    "type": "framework",
                    "details": "node/gcpfunctions.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/gcp-functions/",
                    "name": "Google Cloud Functions (Node)",
                    "aliases": [],
                    "categories": [],
                },
                "_self": {
                    "key": "node",
                    "type": "language",
                    "details": "node.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/",
                    "name": "Node.js",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "koa": {
                    "key": "node.koa",
                    "type": "framework",
                    "details": "node/koa.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/koa/",
                    "name": "Koa",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "serverlesscloud": {
                    "key": "node.serverlesscloud",
                    "type": "framework",
                    "details": "node/serverlesscloud.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/guides/serverless-cloud/",
                    "name": "Express",
                    "aliases": [],
                    "categories": [],
                },
                "tracing": {
                    "key": "node.tracing",
                    "type": "framework",
                    "details": "node/tracing.json",
                    "doc_link": "https://docs.sentry.io/platforms/node/performance/",
                    "name": "Node.js",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-0-alert": {
                    "key": "node.profiling-onboarding-0-alert",
                    "type": "language",
                    "details": "node/profiling-onboarding-0-alert.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Node",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-1-install": {
                    "key": "node.profiling-onboarding-1-install",
                    "type": "language",
                    "details": "node/profiling-onboarding-1-install.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Node",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-2-configure-performance": {
                    "key": "node.profiling-onboarding-2-configure-performance",
                    "type": "language",
                    "details": "node/profiling-onboarding-2-configure-performance.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Node",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-3-configure-profiling": {
                    "key": "node.profiling-onboarding-3-configure-profiling",
                    "type": "language",
                    "details": "node/profiling-onboarding-3-configure-profiling.json",
                    "doc_link": "https://discord.gg/zrMjKA4Vnz",
                    "name": "Node",
                    "aliases": [],
                    "categories": [],
                },
            },
            "native": {
                "_self": {
                    "key": "native",
                    "type": "language",
                    "details": "native.json",
                    "doc_link": "https://docs.sentry.io/platforms/native/",
                    "name": "Native",
                    "aliases": [],
                    "categories": ["mobile", "desktop"],
                },
                "qt": {
                    "key": "native.qt",
                    "type": "framework",
                    "details": "native/qt.json",
                    "doc_link": "https://docs.sentry.io/platforms/native/guides/qt/",
                    "name": "Qt",
                    "aliases": [],
                    "categories": ["desktop", "mobile"],
                },
            },
            "minidump": {
                "_self": {
                    "key": "minidump",
                    "type": "framework",
                    "details": "minidump.json",
                    "doc_link": "https://docs.sentry.io/platforms/native/minidump/",
                    "name": "Minidump",
                    "aliases": [],
                    "categories": [],
                }
            },
            "kotlin": {
                "_self": {
                    "key": "kotlin",
                    "type": "language",
                    "details": "kotlin.json",
                    "doc_link": "https://docs.sentry.io/platforms/kotlin/",
                    "name": "Kotlin",
                    "aliases": [],
                    "categories": ["mobile", "desktop", "server"],
                }
            },
            "javascript": {
                "angular": {
                    "key": "javascript.angular",
                    "type": "framework",
                    "details": "javascript/angular.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/angular/",
                    "name": "Angular",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "angularjs": {
                    "key": "javascript.angularjs",
                    "type": "framework",
                    "details": "javascript/angularjs.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/angular/angular1/",
                    "name": "AngularJS",
                    "aliases": [],
                    "categories": [],
                },
                "backbone": {
                    "key": "javascript.backbone",
                    "type": "framework",
                    "details": "javascript/backbone.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/",
                    "name": "Backbone",
                    "aliases": [],
                    "categories": [],
                },
                "ember": {
                    "key": "javascript.ember",
                    "type": "framework",
                    "details": "javascript/ember.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/ember/",
                    "name": "Ember",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "gatsby": {
                    "key": "javascript.gatsby",
                    "type": "framework",
                    "details": "javascript/gatsby.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/gatsby/",
                    "name": "Gatsby",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "_self": {
                    "key": "javascript",
                    "type": "language",
                    "details": "javascript.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/",
                    "name": "Browser JavaScript",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "nextjs": {
                    "key": "javascript.nextjs",
                    "type": "framework",
                    "details": "javascript/nextjs.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/nextjs/",
                    "wizard_setup": '<p>Configure your app automatically with <a href="https://docs.sentry.io/platforms/javascript/guides/nextjs/#configure">Sentry wizard</a>.</p>\n<div class="gatsby-highlight" data-language="bash"><pre class="language-bash"><code class="language-bash"><span class="token function">yarn</span> <span class="token function">add</span> @sentry/nextjs\n<span class="token comment"># or</span>\n<span class="token function">npm</span> <span class="token function">install</span> --save @sentry/nextjs\n\nnpx @sentry/wizard -i nextjs</code></pre></div>',
                    "name": "Next.js",
                    "aliases": [],
                    "categories": ["browser", "server"],
                },
                "remix": {
                    "key": "javascript.remix",
                    "type": "framework",
                    "details": "javascript/remix.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/remix/",
                    "name": "Remix",
                    "aliases": [],
                    "categories": ["browser", "server"],
                },
                "svelte": {
                    "key": "javascript.svelte",
                    "type": "framework",
                    "details": "javascript/svelte.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/svelte/",
                    "name": "Svelte",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "vue": {
                    "key": "javascript.vue",
                    "type": "framework",
                    "details": "javascript/vue.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/vue/",
                    "name": "Vue",
                    "aliases": [],
                    "categories": ["browser"],
                },
                "vue-replay-onboarding-1-install": {
                    "key": "javascript.vue-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/vue-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "vue-replay-onboarding-2-configure": {
                    "key": "javascript.vue-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/vue-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "svelte-replay-onboarding-1-install": {
                    "key": "javascript.svelte-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/svelte-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "svelte-replay-onboarding-2-configure": {
                    "key": "javascript.svelte-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/svelte-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "remix-replay-onboarding-1-install": {
                    "key": "javascript.remix-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/remix-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "remix-replay-onboarding-2-configure": {
                    "key": "javascript.remix-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/remix-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "react-replay-onboarding-1-install": {
                    "key": "javascript.react-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/react-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "react-replay-onboarding-2-configure": {
                    "key": "javascript.react-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/react-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "nextjs-replay-onboarding-1-install": {
                    "key": "javascript.nextjs-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/nextjs-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "nextjs-replay-onboarding-2-configure": {
                    "key": "javascript.nextjs-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/nextjs-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "replay-onboarding-1-install": {
                    "key": "javascript.replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "replay-onboarding-2-configure": {
                    "key": "javascript.replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "gatsby-replay-onboarding-1-install": {
                    "key": "javascript.gatsby-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/gatsby-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "gatsby-replay-onboarding-2-configure": {
                    "key": "javascript.gatsby-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/gatsby-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "ember-replay-onboarding-1-install": {
                    "key": "javascript.ember-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/ember-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "ember-replay-onboarding-2-configure": {
                    "key": "javascript.ember-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/ember-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "capacitor-replay-onboarding-1-install": {
                    "key": "javascript.capacitor-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/capacitor-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/capacitor/session-replay/",
                    "name": "Capacitor",
                    "aliases": [],
                    "categories": [],
                },
                "capacitor-replay-onboarding-2-configure": {
                    "key": "javascript.capacitor-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/capacitor-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/capacitor/session-replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "angular-replay-onboarding-1-install": {
                    "key": "javascript.angular-replay-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/angular-replay-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "angular-replay-onboarding-2-configure": {
                    "key": "javascript.angular-replay-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/angular-replay-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/replay/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "react-performance-onboarding-1-install": {
                    "key": "javascript.react-performance-onboarding-1-install",
                    "type": "framework",
                    "details": "javascript/react-performance-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react/performance/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
                "react-performance-onboarding-2-configure": {
                    "key": "javascript.react-performance-onboarding-2-configure",
                    "type": "framework",
                    "details": "javascript/react-performance-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react/performance/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
                "react-performance-onboarding-3-verify": {
                    "key": "javascript.react-performance-onboarding-3-verify",
                    "type": "framework",
                    "details": "javascript/react-performance-onboarding-3-verify.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react/performance/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
                "performance-onboarding-1-install": {
                    "key": "javascript.performance-onboarding-1-install",
                    "type": "language",
                    "details": "javascript/performance-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/performance/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "performance-onboarding-2-configure": {
                    "key": "javascript.performance-onboarding-2-configure",
                    "type": "language",
                    "details": "javascript/performance-onboarding-2-configure.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/performance/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "performance-onboarding-3-verify": {
                    "key": "javascript.performance-onboarding-3-verify",
                    "type": "language",
                    "details": "javascript/performance-onboarding-3-verify.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/performance/",
                    "name": "JavaScript",
                    "aliases": [],
                    "categories": [],
                },
                "react-with-error-monitoring-and-replay": {
                    "key": "javascript.react-with-error-monitoring-and-replay",
                    "type": "framework",
                    "details": "javascript/react-with-error-monitoring-and-replay.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring-and-replay/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
                "react-with-error-monitoring-and-performance": {
                    "key": "javascript.react-with-error-monitoring-and-performance",
                    "type": "framework",
                    "details": "javascript/react-with-error-monitoring-and-performance.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring-and-performance/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
                "react-with-error-monitoring-performance-and-replay": {
                    "key": "javascript.react-with-error-monitoring-performance-and-replay",
                    "type": "framework",
                    "details": "javascript/react-with-error-monitoring-performance-and-replay.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring-performance-and-replay/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
                "react-with-error-monitoring": {
                    "key": "javascript.react-with-error-monitoring",
                    "type": "framework",
                    "details": "javascript/react-with-error-monitoring.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring/",
                    "name": "React",
                    "aliases": [],
                    "categories": [],
                },
            },
            "java": {
                "_self": {
                    "key": "java",
                    "type": "language",
                    "details": "java.json",
                    "doc_link": "https://docs.sentry.io/platforms/java/",
                    "name": "Java",
                    "aliases": [],
                    "categories": ["desktop", "server"],
                },
                "log4j2": {
                    "key": "java.log4j2",
                    "type": "framework",
                    "details": "java/log4j2.json",
                    "doc_link": "https://docs.sentry.io/platforms/java/guides/log4j2/",
                    "name": "Log4j 2.x",
                    "aliases": [],
                    "categories": ["desktop", "server"],
                },
                "logback": {
                    "key": "java.logback",
                    "type": "framework",
                    "details": "java/logback.json",
                    "doc_link": "https://docs.sentry.io/platforms/java/guides/logback/",
                    "name": "Logback",
                    "aliases": [],
                    "categories": ["desktop", "server"],
                },
                "spring-boot": {
                    "key": "java.spring-boot",
                    "type": "framework",
                    "details": "java/spring-boot.json",
                    "doc_link": "https://docs.sentry.io/platforms/java/guides/spring-boot/",
                    "name": "Spring Boot",
                    "aliases": [],
                    "categories": ["desktop", "server"],
                },
                "spring": {
                    "key": "java.spring",
                    "type": "framework",
                    "details": "java/spring.json",
                    "doc_link": "https://https://docs.sentry.io/platforms/java/guides/spring/",
                    "name": "Spring",
                    "aliases": [],
                    "categories": ["desktop", "server"],
                },
            },
            "ionic": {
                "_self": {
                    "key": "ionic",
                    "type": "framework",
                    "details": "ionic.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/capacitor/",
                    "name": "Ionic",
                    "aliases": [],
                    "categories": [],
                }
            },
            "go": {
                "_self": {
                    "key": "go",
                    "type": "language",
                    "details": "go.json",
                    "doc_link": "https://docs.sentry.io/platforms/go/",
                    "name": "Go",
                    "aliases": [],
                    "categories": [],
                }
            },
            "flutter": {
                "_self": {
                    "key": "flutter",
                    "type": "framework",
                    "details": "flutter.json",
                    "doc_link": "https://docs.sentry.io/platforms/flutter/",
                    "name": "Flutter",
                    "aliases": [],
                    "categories": ["mobile", "browser", "desktop"],
                }
            },
            "elixir": {
                "_self": {
                    "key": "elixir",
                    "type": "language",
                    "details": "elixir.json",
                    "doc_link": "https://docs.sentry.io/platforms/elixir/",
                    "name": "Elixir",
                    "aliases": [],
                    "categories": [],
                }
            },
            "electron": {
                "_self": {
                    "key": "electron",
                    "type": "language",
                    "details": "electron.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/electron/",
                    "name": "Electron",
                    "aliases": [],
                    "categories": [],
                }
            },
            "dotnet": {
                "aspnet": {
                    "key": "dotnet.aspnet",
                    "type": "framework",
                    "details": "dotnet/aspnet.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/aspnet/",
                    "name": "ASP.NET",
                    "aliases": [],
                    "categories": [],
                },
                "aspnetcore": {
                    "key": "dotnet.aspnetcore",
                    "type": "framework",
                    "details": "dotnet/aspnetcore.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/aspnetcore/",
                    "name": "ASP.NET Core",
                    "aliases": [],
                    "categories": [],
                },
                "awslambda": {
                    "key": "dotnet.awslambda",
                    "type": "framework",
                    "details": "dotnet/awslambda.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/aws-lambda/",
                    "name": "AWS Lambda (.NET)",
                    "aliases": [],
                    "categories": [],
                },
                "gcpfunctions": {
                    "key": "dotnet.gcpfunctions",
                    "type": "framework",
                    "details": "dotnet/gcpfunctions.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/google-cloud-functions/",
                    "name": "Google Cloud Functions (.NET)",
                    "aliases": [],
                    "categories": [],
                },
                "_self": {
                    "key": "dotnet",
                    "type": "language",
                    "details": "dotnet.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/",
                    "name": ".NET",
                    "aliases": ["C#"],
                    "categories": [],
                },
                "maui": {
                    "key": "dotnet.maui",
                    "type": "framework",
                    "details": "dotnet/maui.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/maui/",
                    "name": "Multi-platform App UI (MAUI)",
                    "aliases": [],
                    "categories": [],
                },
                "uwp": {
                    "key": "dotnet.uwp",
                    "type": "language",
                    "details": "dotnet/uwp.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/uwp/",
                    "name": "Universal Windows Platform",
                    "aliases": [],
                    "categories": [],
                },
                "winforms": {
                    "key": "dotnet.winforms",
                    "type": "language",
                    "details": "dotnet/winforms.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/winforms/",
                    "name": "Windows Forms",
                    "aliases": [],
                    "categories": [],
                },
                "wpf": {
                    "key": "dotnet.wpf",
                    "type": "language",
                    "details": "dotnet/wpf.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/wpf/",
                    "name": "Windows Presentation Foundation",
                    "aliases": [],
                    "categories": [],
                },
                "xamarin": {
                    "key": "dotnet.xamarin",
                    "type": "library",
                    "details": "dotnet/xamarin.json",
                    "doc_link": "https://docs.sentry.io/platforms/dotnet/guides/xamarin/",
                    "name": "Xamarin",
                    "aliases": [],
                    "categories": [],
                },
            },
            "dart": {
                "_self": {
                    "key": "dart",
                    "type": "framework",
                    "details": "dart.json",
                    "doc_link": "https://docs.sentry.io/platforms/dart/",
                    "name": "Dart",
                    "aliases": [],
                    "categories": ["mobile", "browser", "server"],
                }
            },
            "cordova": {
                "_self": {
                    "key": "cordova",
                    "type": "language",
                    "details": "cordova.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/cordova/",
                    "name": "Cordova",
                    "aliases": [],
                    "categories": [],
                }
            },
            "capacitor": {
                "_self": {
                    "key": "capacitor",
                    "type": "framework",
                    "details": "capacitor.json",
                    "doc_link": "https://docs.sentry.io/platforms/javascript/guides/capacitor/",
                    "name": "Capacitor",
                    "aliases": [],
                    "categories": [],
                }
            },
            "apple": {
                "_self": {
                    "key": "apple",
                    "type": "language",
                    "details": "apple.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/",
                    "name": "Apple",
                    "aliases": ["cocoa"],
                    "categories": ["mobile", "desktop"],
                },
                "ios": {
                    "key": "apple.ios",
                    "type": "language",
                    "details": "apple/ios.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/",
                    "name": "iOS",
                    "aliases": [],
                    "categories": ["mobile"],
                },
                "macos": {
                    "key": "apple.macos",
                    "type": "language",
                    "details": "apple/macos.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/",
                    "name": "macOS",
                    "aliases": [],
                    "categories": ["desktop"],
                },
                "ios-profiling-onboarding-1-install": {
                    "key": "apple.ios-profiling-onboarding-1-install",
                    "type": "language",
                    "details": "apple/ios-profiling-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/guides/ios/profiling/",
                    "name": "iOS",
                    "aliases": [],
                    "categories": [],
                },
                "ios-profiling-onboarding-2-configure-performance": {
                    "key": "apple.ios-profiling-onboarding-2-configure-performance",
                    "type": "language",
                    "details": "apple/ios-profiling-onboarding-2-configure-performance.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/guides/ios/profiling/",
                    "name": "iOS",
                    "aliases": [],
                    "categories": [],
                },
                "ios-profiling-onboarding-3-configure-profiling": {
                    "key": "apple.ios-profiling-onboarding-3-configure-profiling",
                    "type": "language",
                    "details": "apple/ios-profiling-onboarding-3-configure-profiling.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/guides/ios/profiling/",
                    "name": "iOS",
                    "aliases": [],
                    "categories": [],
                },
                "ios-profiling-onboarding-4-upload": {
                    "key": "apple.ios-profiling-onboarding-4-upload",
                    "type": "language",
                    "details": "apple/ios-profiling-onboarding-4-upload.json",
                    "doc_link": "https://docs.sentry.io/platforms/apple/guides/ios/profiling/",
                    "name": "iOS",
                    "aliases": [],
                    "categories": [],
                },
            },
            "android": {
                "_self": {
                    "key": "android",
                    "type": "framework",
                    "details": "android.json",
                    "doc_link": "https://docs.sentry.io/platforms/android/",
                    "name": "Android",
                    "aliases": [],
                    "categories": ["mobile"],
                },
                "profiling-onboarding-1-install": {
                    "key": "android.profiling-onboarding-1-install",
                    "type": "language",
                    "details": "android/profiling-onboarding-1-install.json",
                    "doc_link": "https://docs.sentry.io/platforms/android/profiling/",
                    "name": "Android",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-2-configure-performance": {
                    "key": "android.profiling-onboarding-2-configure-performance",
                    "type": "language",
                    "details": "android/profiling-onboarding-2-configure-performance.json",
                    "doc_link": "https://docs.sentry.io/platforms/android/profiling/",
                    "name": "Android",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-3-configure-profiling": {
                    "key": "android.profiling-onboarding-3-configure-profiling",
                    "type": "language",
                    "details": "android/profiling-onboarding-3-configure-profiling.json",
                    "doc_link": "https://docs.sentry.io/platforms/android/profiling/",
                    "name": "Android",
                    "aliases": [],
                    "categories": [],
                },
                "profiling-onboarding-4-upload": {
                    "key": "android.profiling-onboarding-4-upload",
                    "type": "language",
                    "details": "android/profiling-onboarding-4-upload.json",
                    "doc_link": "https://docs.sentry.io/platforms/android/profiling/",
                    "name": "Android",
                    "aliases": [],
                    "categories": [],
                },
            },
        }
    }
    platform_list: list[Platform] = []
    for platform_id, integrations in data["platforms"].items():
        platform_list.append(
            {
                "id": platform_id,
                "name": integrations["_self"]["name"],
                "integrations": [
                    {
                        "id": get_integration_id(platform_id, i_id),
                        "name": i_data["name"],
                        "type": i_data["type"],
                        "link": i_data["doc_link"],
                    }
                    for i_id, i_data in sorted(integrations.items(), key=lambda x: x[1]["name"])
                ],
            }
        )

    platform_list.sort(key=lambda x: x["name"])

    dump_doc("_platforms", {"platforms": platform_list})

    # This value is derived from https://docs.python.org/3/library/concurrent.futures.html#threadpoolexecutor
    MAX_THREADS = 32
    thread_count = min(len(data["platforms"]), multiprocessing.cpu_count() * 5, MAX_THREADS)
    with concurrent.futures.ThreadPoolExecutor(thread_count) as exe:
        for future in concurrent.futures.as_completed(
            exe.submit(
                sync_integration_docs,
                platform_id,
                integration_id,
                integration["details"],
                quiet,
            )
            for platform_id, platform_data in data["platforms"].items()
            for integration_id, integration in platform_data.items()
        ):
            future.result()  # needed to trigger exceptions


def sync_integration_docs(
    platform_id: str, integration_id: str, path: str, quiet: bool = False
) -> None:
    if not quiet:
        echo(f"  syncing documentation for {platform_id}.{integration_id} integration")

    if integration_id == "react-with-error-monitoring-performance-and-replay":
        data = {
            "key": "javascript.react-with-error-monitoring-performance-and-replay",
            "type": "framework",
            "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring-performance-and-replay/",
            "name": "React",
            "aliases": [],
            "categories": [],
            "body": '<h2 id="install" style="position:relative;">Install</h2>\n<p>Sentry captures data by using an SDK within your application’s runtime.</p>\n<div class="gatsby-highlight" data-language="bash"><pre class="language-bash highlight"><code class="language-bash"><span class="token comment"># Using yarn</span>\n<span class="token function">yarn</span> <span class="token function">add</span> @sentry/react @sentry/tracing\n\n<span class="token comment"># Using npm</span>\n<span class="token function">npm</span> <span class="token function">install</span> --save @sentry/react @sentry/tracing</code></pre></div>\n<h2 id="configure" style="position:relative;">Configure</h2>\n<p>Initialize Sentry as early as possible in your application\'s lifecycle.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">import</span> <span class="token punctuation">{</span> createRoot <span class="token punctuation">}</span> React <span class="token keyword">from</span> <span class="token string">"react-dom/client"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> React <span class="token keyword">from</span> <span class="token string">"react"</span><span class="token punctuation">;</span>  \n<span class="token keyword">import</span> <span class="token operator">*</span> <span class="token keyword">as</span> Sentry <span class="token keyword">from</span> <span class="token string">"@sentry/react"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> <span class="token punctuation">{</span> BrowserTracing <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">"@sentry/tracing"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> App <span class="token keyword">from</span> <span class="token string">"./App"</span><span class="token punctuation">;</span>\n\nSentry<span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">{</span>\n  <span class="token literal-property property">dsn</span><span class="token operator">:</span> <span class="token string">"___PUBLIC_DSN___"</span><span class="token punctuation">,</span>\n  <span class="token literal-property property">integrations</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token keyword">new</span> <span class="token class-name">BrowserTracing</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">,</span> <span class="token keyword">new</span> <span class="token class-name">Sentry<span class="token punctuation">.</span>Replay</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  <span class="token comment">// Performance Monitoring</span>\n  <span class="token literal-property property">tracesSampleRate</span><span class="token operator">:</span> <span class="token number">1.0</span><span class="token punctuation">,</span> <span class="token comment">// Capture 100% of the transactions, reduce in production!</span>\n  <span class="token comment">// Session Replay</span>\n  <span class="token literal-property property">replaysSessionSampleRate</span><span class="token operator">:</span> <span class="token number">0.1</span><span class="token punctuation">,</span> <span class="token comment">// This sets the sample rate to be 10%. You may want this to be 100% while in development and sample at a lower rate in production</span>\n  <span class="token literal-property property">replaysOnErrorSampleRate</span><span class="token operator">:</span> <span class="token number">1.0</span><span class="token punctuation">,</span> <span class="token comment">// If the entire session is not sampled, use this sample rate to sample sessions when an error occurs.</span>\n<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>\n\n<span class="token keyword">const</span> container <span class="token operator">=</span> document<span class="token punctuation">.</span><span class="token function">getElementById</span><span class="token punctuation">(</span>“app”<span class="token punctuation">)</span><span class="token punctuation">;</span>\n<span class="token keyword">const</span> root <span class="token operator">=</span> <span class="token function">createRoot</span><span class="token punctuation">(</span>container<span class="token punctuation">)</span><span class="token punctuation">;</span>\nroot<span class="token punctuation">.</span><span class="token function">render</span><span class="token punctuation">(</span><span class="token operator">&lt;</span>App <span class="token operator">/</span><span class="token operator">&gt;</span><span class="token punctuation">)</span></code></pre></div>\n<h2 id="verify" style="position:relative;">Verify</h2>\n<p>This snippet contains an intentional error and can be used as a test to make sure that everything\'s working as expected.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">return</span> <span class="token operator">&lt;</span>button onClick<span class="token operator">=</span><span class="token punctuation">{</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=&gt;</span> <span class="token function">methodDoesNotExist</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">}</span><span class="token operator">&gt;</span>Break the world<span class="token operator">&lt;</span><span class="token operator">/</span>button<span class="token operator">&gt;</span><span class="token punctuation">;</span></code></pre></div>\n<hr>\n<h2 id="next-steps" style="position:relative;">Next Steps</h2>\n<ul>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/">Source Maps</a>: Learn how to enable readable stack traces in your Sentry errors.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/features/">React Features</a>: Learn about our first class integration with the React framework.</li>\n</ul>',
        }
    elif integration_id == "react-with-error-monitoring-and-performance":
        data = {
            "key": "javascript.react-with-error-monitoring-and-performance",
            "type": "framework",
            "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring-and-performance/",
            "name": "React",
            "aliases": [],
            "categories": [],
            "body": '<p>In this quick guide you’ll set up:</p>\n<ul>\n<li><code>@sentry/react</code> for <a href="https://docs.sentry.io/platforms/javascript/guides/react/">error monitoring</a></li>\n<li><code>@sentry/tracing</code> for <a href="https://docs.sentry.io/platforms/javascript/guides/react/performance/">performance monitoring</a></li>\n</ul>\n<hr>\n<h2 id="install" style="position:relative;">Install</h2>\n<p>Sentry captures data by using an SDK within your application’s runtime.</p>\n<div class="gatsby-highlight" data-language="bash"><pre class="language-bash highlight"><code class="language-bash"><span class="token comment"># Using yarn</span>\n<span class="token function">yarn</span> <span class="token function">add</span> @sentry/react @sentry/tracing\n\n<span class="token comment"># Using npm</span>\n<span class="token function">npm</span> <span class="token function">install</span> --save @sentry/react @sentry/tracing</code></pre></div>\n<h2 id="configure" style="position:relative;">Configure</h2>\n<p>Initialize Sentry as early as possible in your application\'s lifecycle.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">import</span> <span class="token punctuation">{</span> createRoot <span class="token punctuation">}</span> React <span class="token keyword">from</span> <span class="token string">"react-dom/client"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> React <span class="token keyword">from</span> <span class="token string">"react"</span><span class="token punctuation">;</span>  \n<span class="token keyword">import</span> <span class="token operator">*</span> <span class="token keyword">as</span> Sentry <span class="token keyword">from</span> <span class="token string">"@sentry/react"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> <span class="token punctuation">{</span> BrowserTracing <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">"@sentry/tracing"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> App <span class="token keyword">from</span> <span class="token string">"./App"</span><span class="token punctuation">;</span>\n\nSentry<span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">{</span>\n  <span class="token literal-property property">dsn</span><span class="token operator">:</span> <span class="token string">"___PUBLIC_DSN___"</span><span class="token punctuation">,</span>\n  <span class="token literal-property property">integrations</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token keyword">new</span> <span class="token class-name">BrowserTracing</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  <span class="token comment">// Performance Monitoring</span>\n  <span class="token literal-property property">tracesSampleRate</span><span class="token operator">:</span> <span class="token number">1.0</span><span class="token punctuation">,</span> <span class="token comment">// Capture 100% of the transactions, reduce in production!</span>\n<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>\n\n<span class="token keyword">const</span> container <span class="token operator">=</span> document<span class="token punctuation">.</span><span class="token function">getElementById</span><span class="token punctuation">(</span>“app”<span class="token punctuation">)</span><span class="token punctuation">;</span>\n<span class="token keyword">const</span> root <span class="token operator">=</span> <span class="token function">createRoot</span><span class="token punctuation">(</span>container<span class="token punctuation">)</span><span class="token punctuation">;</span>\nroot<span class="token punctuation">.</span><span class="token function">render</span><span class="token punctuation">(</span><span class="token operator">&lt;</span>App <span class="token operator">/</span><span class="token operator">&gt;</span><span class="token punctuation">)</span></code></pre></div>\n<h2 id="verify" style="position:relative;">Verify</h2>\n<p>This snippet contains an intentional error and can be used as a test to make sure that everything\'s working as expected.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">return</span> <span class="token operator">&lt;</span>button onClick<span class="token operator">=</span><span class="token punctuation">{</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=&gt;</span> <span class="token function">methodDoesNotExist</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">}</span><span class="token operator">&gt;</span>Break the world<span class="token operator">&lt;</span><span class="token operator">/</span>button<span class="token operator">&gt;</span><span class="token punctuation">;</span></code></pre></div>\n<hr>\n<h2 id="next-steps" style="position:relative;">Next Steps</h2>\n<ul>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/">Source Maps</a>: Learn how to enable readable stack traces in your Sentry errors.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/features/">React Features</a>: Learn about our first class integration with the React framework.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/session-replay/">Session Replay</a>: Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.</li>\n</ul>',
        }
    elif integration_id == "react-with-error-monitoring":
        data = {
            "key": "javascript.react-with-error-monitoring",
            "type": "framework",
            "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring/",
            "name": "React",
            "aliases": [],
            "categories": [],
            "body": '<h2 id="install" style="position:relative;">Install</h2>\n<p>Sentry captures data by using an SDK within your application’s runtime.</p>\n<div class="gatsby-highlight" data-language="bash"><pre class="language-bash highlight"><code class="language-bash"><span class="token comment"># Using yarn</span>\n<span class="token function">yarn</span> <span class="token function">add</span> @sentry/react\n\n<span class="token comment"># Using npm</span>\n<span class="token function">npm</span> <span class="token function">install</span> --save @sentry/react</code></pre></div>\n<h2 id="configure" style="position:relative;">Configure</h2>\n<p>Initialize Sentry as early as possible in your application\'s lifecycle.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">import</span> <span class="token punctuation">{</span> createRoot <span class="token punctuation">}</span> React <span class="token keyword">from</span> <span class="token string">"react-dom/client"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> React <span class="token keyword">from</span> <span class="token string">"react"</span><span class="token punctuation">;</span>  \n<span class="token keyword">import</span> <span class="token operator">*</span> <span class="token keyword">as</span> Sentry <span class="token keyword">from</span> <span class="token string">"@sentry/react"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> App <span class="token keyword">from</span> <span class="token string">"./App"</span><span class="token punctuation">;</span>\n\nSentry<span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">{</span>\n  <span class="token literal-property property">dsn</span><span class="token operator">:</span> <span class="token string">"___PUBLIC_DSN___"</span><span class="token punctuation">,</span>\n<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>\n\n<span class="token keyword">const</span> container <span class="token operator">=</span> document<span class="token punctuation">.</span><span class="token function">getElementById</span><span class="token punctuation">(</span>“app”<span class="token punctuation">)</span><span class="token punctuation">;</span>\n<span class="token keyword">const</span> root <span class="token operator">=</span> <span class="token function">createRoot</span><span class="token punctuation">(</span>container<span class="token punctuation">)</span><span class="token punctuation">;</span>\nroot<span class="token punctuation">.</span><span class="token function">render</span><span class="token punctuation">(</span><span class="token operator">&lt;</span>App <span class="token operator">/</span><span class="token operator">&gt;</span><span class="token punctuation">)</span></code></pre></div>\n<h2 id="verify" style="position:relative;">Verify</h2>\n<p>This snippet contains an intentional error and can be used as a test to make sure that everything\'s working as expected.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">return</span> <span class="token operator">&lt;</span>button onClick<span class="token operator">=</span><span class="token punctuation">{</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=&gt;</span> <span class="token function">methodDoesNotExist</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">}</span><span class="token operator">&gt;</span>Break the world<span class="token operator">&lt;</span><span class="token operator">/</span>button<span class="token operator">&gt;</span><span class="token punctuation">;</span></code></pre></div>\n<hr>\n<h2 id="next-steps" style="position:relative;">Next Steps</h2>\n<ul>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/">Source Maps</a>: Learn how to enable readable stack traces in your Sentry errors.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/features/">React Features</a>: Learn about our first class integration with the React framework.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/performance/">Performance Monitoring</a>: Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/session-replay/">Session Replay</a>: Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.</li>\n</ul>',
        }
    elif integration_id == "react-with-error-monitoring-and-replay":
        data = {
            "key": "javascript.react-with-error-monitoring-and-replay",
            "type": "framework",
            "doc_link": "https://docs.sentry.io/platforms/javascript/guides/react-with-error-monitoring-and-replay/",
            "name": "React",
            "aliases": [],
            "categories": [],
            "body": '<h2 id="install" style="position:relative;">Install</h2>\n<p>Sentry captures data by using an SDK within your application’s runtime.</p>\n<div class="gatsby-highlight" data-language="bash"><pre class="language-bash highlight"><code class="language-bash"><span class="token comment"># Using yarn</span>\n<span class="token function">yarn</span> <span class="token function">add</span> @sentry/react</code></pre></div>\n<h2 id="configure" style="position:relative;">Configure</h2>\n<p>Initialize Sentry as early as possible in your application\'s lifecycle.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">import</span> <span class="token punctuation">{</span> createRoot <span class="token punctuation">}</span> React <span class="token keyword">from</span> <span class="token string">"react-dom/client"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> React <span class="token keyword">from</span> <span class="token string">"react"</span><span class="token punctuation">;</span>  \n<span class="token keyword">import</span> <span class="token operator">*</span> <span class="token keyword">as</span> Sentry <span class="token keyword">from</span> <span class="token string">"@sentry/react"</span><span class="token punctuation">;</span>\n<span class="token keyword">import</span> App <span class="token keyword">from</span> <span class="token string">"./App"</span><span class="token punctuation">;</span>\n\nSentry<span class="token punctuation">.</span><span class="token function">init</span><span class="token punctuation">(</span><span class="token punctuation">{</span>\n  <span class="token literal-property property">dsn</span><span class="token operator">:</span> <span class="token string">"___PUBLIC_DSN___"</span><span class="token punctuation">,</span>\n  <span class="token literal-property property">integrations</span><span class="token operator">:</span> <span class="token punctuation">[</span><span class="token keyword">new</span> <span class="token class-name">Sentry<span class="token punctuation">.</span>Replay</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">]</span><span class="token punctuation">,</span>\n  <span class="token comment">// Session Replay</span>\n  <span class="token literal-property property">replaysSessionSampleRate</span><span class="token operator">:</span> <span class="token number">0.1</span><span class="token punctuation">,</span> <span class="token comment">// This sets the sample rate to be 10%. You may want this to be 100% while in development and sample at a lower rate in production</span>\n  <span class="token literal-property property">replaysOnErrorSampleRate</span><span class="token operator">:</span> <span class="token number">1.0</span><span class="token punctuation">,</span> <span class="token comment">// If the entire session is not sampled, use this sample rate to sample sessions when an error occurs.</span>\n<span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>\n\n<span class="token keyword">const</span> container <span class="token operator">=</span> document<span class="token punctuation">.</span><span class="token function">getElementById</span><span class="token punctuation">(</span>“app”<span class="token punctuation">)</span><span class="token punctuation">;</span>\n<span class="token keyword">const</span> root <span class="token operator">=</span> <span class="token function">createRoot</span><span class="token punctuation">(</span>container<span class="token punctuation">)</span><span class="token punctuation">;</span>\nroot<span class="token punctuation">.</span><span class="token function">render</span><span class="token punctuation">(</span><span class="token operator">&lt;</span>App <span class="token operator">/</span><span class="token operator">&gt;</span><span class="token punctuation">)</span></code></pre></div>\n<h2 id="verify" style="position:relative;">Verify</h2>\n<p>This snippet contains an intentional error and can be used as a test to make sure that everything\'s working as expected.</p>\n<div class="gatsby-highlight" data-language="javascript"><pre class="language-javascript highlight"><code class="language-javascript"><span class="token keyword">return</span> <span class="token operator">&lt;</span>button onClick<span class="token operator">=</span><span class="token punctuation">{</span><span class="token punctuation">(</span><span class="token punctuation">)</span> <span class="token operator">=&gt;</span> <span class="token function">methodDoesNotExist</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">}</span><span class="token operator">&gt;</span>Break the world<span class="token operator">&lt;</span><span class="token operator">/</span>button<span class="token operator">&gt;</span><span class="token punctuation">;</span></code></pre></div>\n<hr>\n<h2 id="next-steps" style="position:relative;">Next Steps</h2>\n<ul>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/sourcemaps/">Source Maps</a>: Learn how to enable readable stack traces in your Sentry errors.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/features/">React Features</a>: Learn about our first class integration with the React framework.</li>\n<li><a href="https://docs.sentry.io/platforms/javascript/guides/react/performance/">Performance Monitoring</a>: Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.</li>\n</ul>',
        }
    else:
        data = json.load(urlopen_with_retries(BASE_URL.format(path)))

    key = get_integration_id(platform_id, integration_id)

    dump_doc(
        key,
        {
            "id": key,
            "name": data["name"],
            "html": data["body"],
            "link": data["doc_link"],
            "wizard_setup": data.get("wizard_setup", None),
        },
    )


def integration_doc_exists(integration_id: str) -> bool:
    # We use listdir() here as integration_id comes from user data
    # and using os.path.join() would allow directory traversal vulnerabilities
    # which we don't want.
    docs = os.listdir(DOC_FOLDER)
    filename = f"{integration_id}.json"
    return filename in docs
