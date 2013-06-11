# Sentry
#
# VERSION 0.0.1

FROM 	ubuntu
MAINTAINER Ken Cochrane <KenCochrane@gmail.com>

# make sure the package repository is up to date
RUN echo "deb http://archive.ubuntu.com/ubuntu precise main universe" > /etc/apt/sources.list
RUN apt-get update
RUN apt-get upgrade
RUN apt-get install -y openssh-server git-core libxml2-dev curl python build-essential make gcc python-dev wget postgresql-client-9.1 postgresql-client-common libpq5 libpq-dev postgresql
RUN wget http://python-distribute.org/distribute_setup.py
RUN python distribute_setup.py
RUN wget https://raw.github.com/pypa/pip/master/contrib/get-pip.py
RUN python get-pip.py
RUN pip install psycopg2 sentry
RUN wget https://gist.github.com/kencochrane/5758137/raw/03f63c3376d6b5f204983e36578de72463f75571/sentry.conf.py
RUN /etc/init.d/postgresql start && su - postgres -c 'createdb sentry' && su - postgres -c 'createuser -D -S -R sentry' && su - postgres -c "echo \"ALTER USER sentry WITH PASSWORD 'sentry';\" | psql -U postgres"

RUN apt-get install -y language-pack-en
RUN echo "export LANGUAGE=en_US.UTF-8" >> /etc/bash.bashrc
RUN echo "export LANG=en_US.UTF-8" >> /etc/bash.bashrc
RUN echo "export LC_ALL=en_US.UTF-8" >> /etc/bash.bashrc
 
RUN locale-gen en_US.UTF-8
RUN dpkg-reconfigure locales
RUN /etc/init.d/postgresql start && /usr/local/bin/sentry --config=sentry.conf.py syncdb --noinput
RUN /etc/init.d/postgresql start && /usr/local/bin/sentry --config=sentry.conf.py migrate

# No admin account created need to do that on your own.

CMD /etc/init.d/postgresql start && /usr/local/bin/sentry --config=/sentry.conf.py start

EXPOSE 9000
