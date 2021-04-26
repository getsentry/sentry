#!/bin/bash

set -e

# Ensure custom workspace
ln -s $(pwd) /js/
cd /js

if [[ ! -f workspace/setup.py ]]; then
    >&2 echo "Cannot find setup.py, make sure you have mounted your source dir to /workspace"
    exit 1
fi

export YARN_CACHE_FOLDER="$(mktemp -d)"
python workspace/setup.py bdist_wheel --build-number 0
rm -r "$YARN_CACHE_FOLDER"
pkginfo -f requires_dist --single --sequence-delim=! workspace/dist/*.whl | tr ! \\n > workspace/dist/requirements.txt
