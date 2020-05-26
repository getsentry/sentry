#!/bin/bash

set -e

if [ ! -f setup.py ]; then
    >&2 echo "Cannot find setup.py, make sure you have mounted your source dir to /workspace"
    exit 1
fi

if [ ! -d "node_modules" ]; then
  mkdir node_modules
fi
echo "Populating node_modules cache..."
cp -ur /js/node_modules/* ./node_modules/

export YARN_CACHE_FOLDER="$(mktemp -d)"
python setup.py bdist_wheel
rm -r "$YARN_CACHE_FOLDER"
pkginfo -f requires_dist --single --sequence-delim=! dist/*.whl | tr ! \\n > dist/requirements.txt
