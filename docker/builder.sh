#!/bin/bash

set -e

# Ensure custom workspace
echo $(pwd)
ln -s $(pwd) /js/workspace
cd /js/workspace

echo $(pwd)
ls -lah

if [[ ! -f setup.py ]]; then
    >&2 echo "Cannot find setup.py, make sure you have mounted your source dir to /workspace"
    exit 1
fi

export YARN_CACHE_FOLDER="$(mktemp -d)"
python setup.py bdist_wheel --build-number 0
rm -r "$YARN_CACHE_FOLDER"
pkginfo -f requires_dist --single --sequence-delim=! dist/*.whl | tr ! \\n > dist/requirements.txt
