# This Docker file simply modifies the CMD parameter to support
# the $PORT usage in Heroku.
FROM getsentry/sentry:nightly
RUN adduser sentry_user
USER sentry_user
# Heroku use $PORT, thus, it will overwrite this
ENV PORT="8000"
CMD sentry run web --bind 0.0.0.0:$PORT
