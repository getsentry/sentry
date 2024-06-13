from hashlib import sha256

LOCKED_FILE = "src/sentry/sentry_metrics/indexer/strings.py"
LOCKED_DIGEST = "c667a458c2cc081103a289c84bb4a2d7b6c6d785e542e6f22d997657568ddf68"
MESSAGE = f"""{LOCKED_FILE} is locked.

* We have detected you made changes to this file.
* We've locked this file following INC-680.
* Please remove the changes to this file.
"""


def test_prevent_indexer_strings_modification():
    with open(LOCKED_FILE, "rb") as f:
        digest = sha256(f.read()).hexdigest()
        assert LOCKED_DIGEST == digest, MESSAGE
