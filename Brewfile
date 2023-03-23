# required to run devservices
cask 'docker'

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


# required for secret checks
brew 'trufflesecurity/trufflehog/trufflehog'
