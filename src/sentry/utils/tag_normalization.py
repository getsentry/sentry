import functools
import re

_KNOWN_TAGS = {
    "sentry.cocoa",
    "sentry.dart",
    "sentry.dotnet",
    "sentry.elixir",
    "sentry.go",
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
    "sentry.javascript.react.native",
    "sentry.javascript.remix",
    "sentry.javascript.serverless",
    "sentry.javascript.sfcc",
    "sentry.javascript.svelte",
    "sentry.javascript.sveltekit",
    "sentry.javascript.vue",
    "sentry.kubernetes",
    "sentry.lua",
    "sentry.native.android",
    "sentry.native.dotnet",
    "sentry.native.unity",
    "sentry.native.unreal",
    "sentry.objc",
    "sentry.perl",
    "sentry.php",
    "sentry.python",
    "sentry.ruby",
    "sentry.rust",
    "sentry.swift",
}


_SYNONYMOUS_TAGS = {
    "sentry.cordova": "sentery.javascript.cordova",
    "sentry.electron": "sentry.javascript.electron",
    "sentry.javascript.angular.ivy": "sentry.javascript.angular",
    "sentry.javascript.react.expo": "sentry.javascript.react",
    "sentry.javascript.react.native.expo": "sentry.javascript.react.native",
    "sentry.laravel": "sentry.php.laravel",
    "sentry.react": "sentry.javascript.react",
    "sentry.symfony": "sentry.php.symfony",
    "sentry.unity": "sentry.native.unity",
}


@functools.lru_cache(maxsize=300)
def normalize_sdk_tag(tag: str) -> str:
    """
     Normalize tags coming from SDKs to more manageable canonical form, by:

     - combining synonymous tags (`sentry.react` -> `sentry.javascript.react`),
     - ignoring framework differences (`sentry.python.flask` and `sentry.python.django` -> `sentry.python`)
     - collapsing all community/third-party SDKs into a single `other` category

    Note: Some platforms may keep their framework-specific values, as needed for analytics.
    """

    # replace non-word characters with dots (normalize sentry-foo to sentry.foo)
    tag = re.sub(r"[\W_]+", ".", tag)

    # collapse known synonymous tags
    tag = _SYNONYMOUS_TAGS.get(tag, tag)

    # ignore non-sentry SDK tags
    if not tag.startswith("sentry."):
        return "other"

    # collapse tags other than JavaScript / Native to their top-level SDK

    if not tag.split(".")[1] in {"javascript", "native"}:
        tag = ".".join(tag.split(".", 2)[0:2])

    if tag.split(".")[1] == "native":
        tag = ".".join(tag.split(".", 3)[0:3])

    if tag not in _KNOWN_TAGS:
        tag = "other"

    return tag
