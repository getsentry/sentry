FROM nginx:1.16-alpine

# cleanup unused nginx config
RUN rm /etc/nginx/conf.d/default.conf

# copy our own nginx config
COPY ./conf/reverse-proxy.conf.template /etc/nginx/conf.d
COPY ./conf/nginx.conf /etc/nginx/nginx.conf

# copy startup script
COPY ./docker-entrypoint.sh /docker-entrypoint.sh

ENTRYPOINT ["/bin/bash", "/docker-entrypoint.sh"]
