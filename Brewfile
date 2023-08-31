# required to run devservices
# colima is a docker-compatible container runtime
brew 'colima'
# while not needed by devservices, the docker cli itself is still useful
# (not docker desktop/daemon which is provided by the cask)
# and is used by some make targets
brew 'docker'
brew 'docker-buildx'

brew 'pyenv'

# required for pyenv's python-build
brew 'openssl'
brew 'readline'

# required for yarn test -u
brew 'watchman'

# direnv isn't defined here, because we have it configured to check for a bootstrapped environment.
# If it's installed in the early steps of the setup process, it just leads to confusion.
# brew 'direnv'

tap 'homebrew/cask'

# required for acceptance testing
cask 'chromedriver'
