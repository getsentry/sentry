import re

r"""
Standard slug pattern:
    (?![0-9]+$) - Negative lookahead to ensure the slug is not entirely numeric
    [a-z0-9_\-] - Matches lowercase letters, numbers, underscores, and hyphens
"""
MIXED_SLUG_PATTERN = r"^(?![0-9]+$)[a-z0-9_\-]+$"
MIXED_SLUG_REGEX = re.compile(MIXED_SLUG_PATTERN)

r"""
Organization slug pattern:
    (?![0-9]+$)   - Negative lookahead to ensure the slug is not entirely numeric
    [a-zA-Z0-9]   - Must start with a letter or number
    [a-zA-Z0-9-]* - Matches letters, numbers, and hyphens
    (?<!-)        - Negative lookbehind to ensure the slug does not end with a hyphen
"""
ORG_SLUG_PATTERN = r"^(?![0-9]+$)[a-zA-Z0-9][a-zA-Z0-9-]*(?<!-)$"
ORG_SLUG_REGEX = re.compile(ORG_SLUG_PATTERN)
