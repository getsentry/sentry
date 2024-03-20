from hashlib import sha256

LOCKED_FILE = "src/sentry/sentry_metrics/indexer/strings.py"
LOCKED_DIGEST = "609a019a93229c352ec38c2be6a0620bfd2964e00315258c32f1502b4bc14add"
MESSAGE = f"""{LOCKED_FILE} is locked.

* We have detected you made changes to this file.
* We've locked this file following INC-680.
* Please remove the changes to this file.
"""


def test_prevent_indexer_strings_modification():
    with open(LOCKED_FILE, "rb") as f:
        digest = sha256(f.read()).hexdigest()
        assert LOCKED_DIGEST == digest, MESSAGE
