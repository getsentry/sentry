# 2021-02-08 - The CI checks the hash of this file to determine if to create a new
# cache or not. If you want to force a new cache simply change the date on the line above
brew 'pyenv'

# required for pyenv's python-build
brew 'openssl'
brew 'readline'

# required for yarn test -u
brew 'watchman'

# required to build some of sentry's dependencies
brew 'pkgconfig'
brew 'libxslt'
brew 'libxmlsec1'
brew 'geoip'

# Currently needed because on Big Sur there's no wheel for it
brew 'librdkafka'

# direnv isn't defined here, because we have it configured to check for a bootstrapped environment.
# If it's installed in the early steps of the setup process, it just leads to confusion.
# brew 'direnv'

tap 'homebrew/cask'

# required for acceptance testing
cask 'chromedriver'

# required to run devservices
cask 'docker'
