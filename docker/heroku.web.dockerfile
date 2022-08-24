# This Docker file simply modifies the CMD parameter to support
# the $PORT usage in Heroku.
FROM getsentry/sentry:nightly
RUN pip install gunicorn

ENV SENTRY_LOG_LEVEL=DEBUG
# add and run as non-root user
RUN adduser sentry_user
USER sentry_user
# Heroku use $PORT, thus, it will overwrite this
ENV PORT="8000"
# run gunicorn
CMD gunicorn sentry.wsgi:application --bind 0.0.0.0:$PORT
