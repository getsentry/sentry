"""
Generate a mapping from file extensions to language for languages that are part of platforms supported by Sentry.
"""

from typing import Dict

import requests
import yaml

response = requests.get(
    "https://raw.githubusercontent.com/github-linguist/linguist/master/lib/linguist/languages.yml"
)
languages_dict = yaml.safe_load(response.content)

# referenced from platforms.tsx and _platforms.json
# node.js contains JavaScript, Python, C, C++, CoffeeScript
# .NET contains C#, F#, visual basic
# apple: swift, objective-c
# android: java, kotlin, dart
# flutter: dart

# pulled from the sentry_projectplatform table: groovy, haskell
languages = [
    "go",
    "javascript",
    "typescript",
    "java",
    "python",
    "php",
    "c",
    "c++",
    "coffeescript",
    "c#",
    "f#",
    "visual basic",
    "swift",
    "objective-c",
    "objective-c++",
    "ruby",
    "kotlin",
    "dart",
    "elixir",
    "rust",
    "scala",
    "perl",
    "groovy",
    "haskell",
    # community supported sdks
    "clojure",
    "coldfusion",
    "crystal",
    "lua",
    "ocaml",
    "hcl",
]

EXTENSION_LANGUAGE_MAP: Dict[str, str] = {}

yaml_languages = languages_dict.keys()


def add_lang_to_map(language, map):
    v = languages_dict[language]

    if v["type"] != "programming":
        return map
    if "extensions" not in v:
        return map

    extensions = v["extensions"]
    for ext in extensions:
        if ext[1:].lower() in extensions:
            raise Exception
        map[ext[1:].lower()] = language.lower()

    return map


for yaml_lang in yaml_languages:
    lowercase_yaml_lang = yaml_lang.lower()
    if lowercase_yaml_lang in languages:
        EXTENSION_LANGUAGE_MAP = add_lang_to_map(yaml_lang, EXTENSION_LANGUAGE_MAP)
    elif "group" in languages_dict[yaml_lang]:
        if languages_dict[yaml_lang]["group"].lower() in languages:
            EXTENSION_LANGUAGE_MAP = add_lang_to_map(yaml_lang, EXTENSION_LANGUAGE_MAP)
    else:
        # check if substring exists
        for lang in languages:
            if lang in lowercase_yaml_lang and len(lang) > 2:
                EXTENSION_LANGUAGE_MAP = add_lang_to_map(yaml_lang, EXTENSION_LANGUAGE_MAP)
