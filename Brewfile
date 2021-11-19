# required to run devservices
cask 'docker'

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

# This is required in order to allow building psycopg2-binary on Apple M1
brew 'postgresql@9.6'

# direnv isn't defined here, because we have it configured to check for a bootstrapped environment.
# If it's installed in the early steps of the setup process, it just leads to confusion.
# brew 'direnv'

tap 'homebrew/cask'

# required for acceptance testing
cask 'chromedriver'
