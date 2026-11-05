from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os.path
import shutil
from collections.abc import Sequence


class Arguments(argparse.Namespace):
    sha: str
    src: str
    dest: str
    cfg: str


def main(argv: Sequence[str] | None = None) -> int:
    """
    Given a set of webpack entrypoint asset files, rename the files to include
    a content hash suffix and produce a json file mapping the orignal asset
    name to the hashed name.

    This is used as part of the frontend deployment to produce an entrypoint
    mapping that is provided to the django backend (via a k8s ConfigMap).
    """
    # XXX(epurkhiser): This is very similar to something like the
    # webpack-manifest-plugin and could potentially be replaced with something
    # like this if we wanted to remove python from our build process

    parser = argparse.ArgumentParser(description=main.__doc__)
    parser.add_argument(
        "--sha",
        required=True,
        help="The commit SHA associated to these hashed entrypoints",
    )
    parser.add_argument(
        "--src",
        required=True,
        help="The directory containing unhashed entrypoint files",
    )
    parser.add_argument(
        "--dest",
        required=True,
        help="The output directory to store the hashed entrypoint files",
    )
    parser.add_argument(
        "--cfg",
        required=True,
        help="The full path of the output json file containing the unhashed -> hashed entrypoint mapping",
    )
    args = parser.parse_args(argv, namespace=Arguments)

    names: dict[str, str] = {}
    os.makedirs(args.dest, exist_ok=True)
    for fname in os.listdir(args.src):
        # each file inside `src` should have an associated `.gz` file
        if fname.endswith(".gz"):
            continue

        full = os.path.join(args.src, fname)
        with open(full, "rb") as f:
            digest = hashlib.sha256(f.read()).digest()
            u64_digest = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()

        base, ext = os.path.splitext(fname)
        new_name = f"{base}-{u64_digest}{ext}"
        names[fname] = new_name
        dest = os.path.join(args.dest, new_name)
        shutil.copy(full, dest)
        shutil.copy(f"{full}.gz", f"{dest}.gz")

    cfg = os.path.abspath(args.cfg)
    os.makedirs(os.path.dirname(cfg), exist_ok=True)
    contents = {"entrypoints": names, "commit_sha": args.sha}

    with open(cfg, "w") as f:
        json.dump(contents, f)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
