from hashlib import md5

# This is a list of locked files and their md5 sum at the time they were locked.
# You can generate the hash using Python
# >>> f = open('src/sentry/sentry_metrics/indexer/strings.py', 'rb')
# >>> import hashlib
# >>> hashlib.md5(f.read()).hexdigest()
# 'edf45a1fb04cbadb5d4f2edb59d884b1'

LOCKED_FILES = {
    "src/sentry/sentry_metrics/indexer/strings.py": {
        "message": """
* This file is locked. We have detected you made changes to this file.
* We've locked this file following INC-680.
* Please remove the changes to this file for this test to pass.
        """,
        # "digest": "edf45a1fb04cbadb5d4f2edb59d884b1",
        "digest": "d41d8cd98f00b204e9800998ecf8427e",
    },
}

DEFAULT_MESSAGE = "This file is locked. Remove the changes to this file for this test to pass."


def test_prevent_file_modifications():
    for filename, metadata in LOCKED_FILES.items():
        with open(filename, "rb") as f:
            digest = md5(f.read()).hexdigest()
            message = metadata.get("message", DEFAULT_MESSAGE)
            assert digest == metadata["digest"], f"\n\nfile: {filename}\n{message}"
