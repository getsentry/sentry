FROM sentry:9.1-onbuild
RUN rm /usr/local/lib/python2.7/site-packages/sentry/web/frontend/base.pyc
RUN rm /usr/local/lib/python2.7/site-packages/sentry/api/endpoints/organization_index.pyc
COPY base.py /usr/local/lib/python2.7/site-packages/sentry/web/frontend/base.py
COPY organization_index.py /usr/local/lib/python2.7/site-packages/sentry/api/endpoints/organization_index.py
