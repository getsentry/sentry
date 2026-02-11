from hashlib import sha256

LOCKED_FILE = "src/sentry/sentry_metrics/indexer/strings.py"
LOCKED_DIGEST = "6d6b48cc1c24b0dd3788cb6d0bb9a69817cef3368febf27548041adf5e84b650"
MESSAGE = f"""{LOCKED_FILE} is locked.

* We have detected you made changes to this file.
* We've locked this file following INC-680.
* Please remove the changes to this file.
"""


def test_prevent_indexer_strings_modification() -> None:
    with open(LOCKED_FILE, "rb") as f:
        digest = sha256(f.read()).hexdigest()
        assert LOCKED_DIGEST == digest, MESSAGE
