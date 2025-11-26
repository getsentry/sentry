FOREVER_CACHE = "max-age=315360000"

# See
# https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#requiring_revalidation
# This means that clients *CAN* cache the resource, but they must revalidate
# before using it This means we will have a small HTTP request overhead to
# verify that the local resource is not outdated
#
# Note that the above docs state that "no-cache" is the same as "max-age=0,
# must-revalidate", but some CDNs will not treat them as the same
NO_CACHE = "max-age=0, must-revalidate"

# no-store means that the response should not be stored in *ANY* cache
NEVER_CACHE = "max-age=0, no-cache, no-store, must-revalidate"
