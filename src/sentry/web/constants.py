FOREVER_CACHE = "max-age=315360000"

# For content-hashed build assets (chunks/, assets/) whose URLs change when
# content changes. Long max-age avoids revalidation on every page load;
# stale-while-revalidate lets the browser serve instantly from cache while
# refreshing in the background, so a misclassified file self-corrects.
IMMUTABLE_CACHE = "max-age=604800, stale-while-revalidate=300"

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
