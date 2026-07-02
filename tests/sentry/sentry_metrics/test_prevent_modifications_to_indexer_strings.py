from hashlib import sha256

LOCKED_FILE = "src/sentry/sentry_metrics/indexer/strings.py"
LOCKED_DIGEST = "9a2c7aeb2abf0c8ce704504201073df1d4776ff2d74d7a7af349bfc0198dedb7"
MESSAGE = f"""{LOCKED_FILE} is locked.

* We have detected you made changes to this file.
* We've locked this file following INC-680.
* Please remove the changes to this file.
"""


def test_prevent_indexer_strings_modification() -> None:
    with open(LOCKED_FILE, "rb") as f:
        digest = sha256(f.read()).hexdigest()
        assert LOCKED_DIGEST == digest, MESSAGE
