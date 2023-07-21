#!/bin/bash

set -e

BREW_PREFIX=$(brew --prefix)

colima stop

echo "Using docker cli from cask."
sudo ln -svf /Applications/Docker.app/Contents/Resources/bin/docker "${BREW_PREFIX}/bin/docker"

echo "Unlinking colima."
brew unlink colima
