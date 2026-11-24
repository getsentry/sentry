#!/bin/sh
# Installs the odiff binary for this machine's architecture to
# /usr/local/bin/odiff.
set -eu

case "$(uname -m)" in
  aarch64) odiff='odiff-linux-arm64' ;;
  *) odiff='odiff-linux-x64' ;;
esac
# A failed download leaves tar with no archive to read, which fails the step.
curl -sL https://registry.npmjs.org/odiff-bin/-/odiff-bin-4.3.8.tgz |
  tar -xz --strip-components=2 "package/raw_binaries/$odiff"
sudo install -m 755 "$odiff" /usr/local/bin/odiff
rm "$odiff"
