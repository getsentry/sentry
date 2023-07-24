#!/bin/bash

set -e

colima stop

echo "Using docker cli from cask."
# brew --prefix doesn't seem to apply here - it's just /usr/local
sudo ln -svf /Applications/Docker.app/Contents/Resources/bin/docker "/usr/local/bin/docker"

echo "Unlinking colima."
brew unlink colima
