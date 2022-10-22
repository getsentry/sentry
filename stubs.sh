#!/bin/bash
set -e

find . -type f -name '*.spec.tsx' \
  -exec sed -i '' -e 's/TestStubs.Project()/Project/' \;
  -exec sed -i $'1 i\import {Project} from \'fixtures\'' \;
