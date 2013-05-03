Throttes and Rate Limiting
==========================

With the way Sentry works you may find yourself in a situation where you'll see
too much inbound traffic without a good way to drop excess messages. There's a
few solutions to this, and you'll likely want to employ them all if you are
faced with this problem.


Rate Limiting with IPTables
---------------------------

One of your first (and most efficient) options is to rate limit with your system's
firewall, in our case, IPTables. If you're not sure how IPTables works, take a
look at `Ubuntu's IPTables How-to <https://help.ubuntu.com/community/IptablesHowTo>`_.

A sampe configuration, which will limit a single IP from bursting more than 5
messages in a 10 second period might look like this::

	# create a new chain for rate limiting
	-N LIMITED
	 
	# rate limit individual ips to prevent stupidity
	-I INPUT -p tcp --dport 80 -m state --state NEW -m recent --set
	-I INPUT -p tcp --dport 443 -m state --state NEW -m recent --set
	-I INPUT -p tcp --dport 80 -m state --state NEW -m recent --update --seconds 10 --hitcount 5 -j LIMITED
	-I INPUT -p tcp --dport 443 -m state --state NEW -m recent --update --seconds 10 --hitcount 5 -j LIMITED
	 
	# log rejected ips
	-A LIMITED -p tcp -m limit --limit 5/min -j LOG --log-prefix "Rejected TCP: " --log-level 7
	-A LIMITED -j REJECT


Enabling Quotas
---------------

The Sentry Team maintains a plugin which enforces project level quotas (using Redis),
which will help to discard events without giving a hard "connection refused" error
like you'd get with your firewall. This is slightly less efficient, as the server
still has to do processing (and more importantly, has to have connections available).

The quota plugin is quite easy to get started with, and you'll find detailed
instructions in the `README <https://github.com/getsentry/sentry-quotas>`_.


Using Cyclops (Client Proxy)
----------------------------

A third option for rate limiting is to do it on the client side. `Cyclops <https://github.com/heynemann/cyclops>`_
is a third-party proxy written in Python (using Tornado) which aims to solve this.

It's not officially supported, however it is used in production by several large
users.
