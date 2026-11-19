#!/bin/sh
# Fails when a generated file differs from the committed one, and prints the
# command that regenerates it.
#
#   check-generated-file.sh FILE DESCRIPTION COMMAND
set -eu

if [ "$#" -ne 3 ]; then
  echo "usage: $0 FILE DESCRIPTION COMMAND" >&2
  exit 2
fi
file=$1
description=$2
command=$3

if ! git diff --exit-code "$file"; then
  echo ""
  echo "❌ $description is out of sync!"
  echo ""
  echo "Run the following command and commit the changes:"
  echo "  $command"
  echo ""
  exit 1
fi
