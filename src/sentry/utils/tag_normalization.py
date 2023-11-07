import functools
import re

_KNOWN_TAGS = {
    "sentry.android",
    "sentry.apex",
    "sentry.brightscript",
    "sentry.cfml",
    "sentry.cli",
    "sentry.cocoa",
    "sentry.cordova",
    "sentry.curl",
    "sentry.dart",
    "sentry.defold",
    "sentry.delphi",
    "sentry.delta",
    "sentry.dotnet",
    "sentry.electron",
    "sentry.elixir",
    "sentry.go",
    "sentry.haxe",
    "sentry.java",
    "sentry.javascript.angular",
    "sentry.javascript.browser",
    "sentry.javascript.capacitor",
    "sentry.javascript.cordova",
    "sentry.javascript.deno",
    "sentry.javascript.electron",
    "sentry.javascript.ember",
    "sentry.javascript.gatsby",
    "sentry.javascript.miniapp",
    "sentry.javascript.nextjs",
    "sentry.javascript.node",
    "sentry.javascript.node.experimental",
    "sentry.javascript.node.hapi",
    "sentry.javascript.raycast",
    "sentry.javascript.react",
    "sentry.javascript.react.expo",
    "sentry.javascript.react.native",
    "sentry.javascript.react.native.expo",
    "sentry.javascript.remix",
    "sentry.javascript.serverless",
    "sentry.javascript.sfcc",
    "sentry.javascript.svelte",
    "sentry.javascript.sveltekit",
    "sentry.javascript.vue",
    "sentry.kubernetes",
    "sentry.last",
    "sentry.light",
    "sentry.lua",
    "sentry.native",
    "sentry.nativescript",
    "sentry.net",
    "sentry.objc",
    "sentry.ocaml",
    "sentry.opentelemetry",
    "sentry.perl",
    "sentry.php",
    "sentry.python",
    "sentry.radar",
    "sentry.ruby",
    "sentry.rust",
    "sentry.sdk",
    "sentry.swift",
    "sentry.tray",
    "sentry.unity",
    "sentry.unsquared",
}

_SYNONYMOUS_TAGS = {
    "sentry.javascript.angular.ivy": "sentry.javascript.angular",
    "sentry.laravel": "sentry.php.laravel",
    "sentry.react": "sentry.javascript.react",
    "sentry.symfony": "sentry.php.symfony",
}


@functools.lru_cache(maxsize=300)
def normalize_sdk_tag(tag: str) -> str:
    """normalizing tags coming from SDKs to more managable canonical form"""

    # ignore non-sentry SDK tags
    if not tag.startswith("sentry"):
        return "other"

    # replace non-word characters with dots (normalize sentry-foo to sentry.foo)
    tag = re.sub(r"[\W_]+", ".", tag)

    # collapse known synonymous tags
    tag = _SYNONYMOUS_TAGS.get(tag, tag)

    # collapse tags other than JavaScript to their top-level SDK
    if not tag.startswith("sentry.javascript"):
        tag = ".".join(tag.split(".", 2)[0:2])

    if tag not in _KNOWN_TAGS:
        tag = "other"

    return tag
