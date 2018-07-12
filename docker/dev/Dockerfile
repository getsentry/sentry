# Sentry dev environment
#

FROM python:2.7.15-slim-jessie

# add user with predictable user/group-id
RUN groupadd -g 20200 sentry && useradd -m -u 20200 -g sentry sentry

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        git \
        libffi-dev \
        libjpeg-dev \
        libpq-dev \
        libxml2-dev \
        libxslt-dev \
        curl \
        make \
        g++ \
				gcc \
				xz-utils \
				bzip2 \
        librabbitmq-dev \
				libxmlsec1-dev \
				pkg-config \
	      libgeoip-dev  \
        libyaml-dev 

# Sane defaults for pip
ENV PIP_NO_CACHE_DIR off
ENV PIP_DISABLE_PIP_VERSION_CHECK on



# get sentry source
RUN git clone https://github.com/getsentry/sentry /usr/src/sentry

# fix shell
RUN rm /bin/sh && ln -sf /bin/bash /bin/sh

# install rust
RUN curl https://sh.rustup.rs -sSf | bash -s -- -y

WORKDIR /usr/src/sentry
# install correct node.js
ENV NVM_DIR /usr/local/nvm
RUN mkdir $NVM_DIR

# install nodejs
RUN curl -SLO "https://nodejs.org/dist/v$(cat .nvmrc)/node-v$(cat .nvmrc)-linux-x64.tar.gz" 
RUN tar -xzf "node-v$(cat .nvmrc)-linux-x64.tar.gz" -C /usr/local --strip-components=1
RUN ln -s /usr/local/bin/node /usr/local/bin/nodejs

# initialize sentry
RUN  make develop
RUN  pip install sentry-plugins





RUN mkdir /etc/sentry
ENV SENTRY_CONF=/etc/sentry/


ADD sentry.conf.py /etc/sentry/
ADD config.yml /etc/sentry/

RUN chown -R sentry.sentry  /usr/src/sentry/

ADD start.sh /start.sh
RUN chmod a+rwx /start.sh
RUN echo fs.inotify.max_user_watches=524288 |  tee -a /etc/sysctl.conf


EXPOSE 8000

CMD /start.sh

