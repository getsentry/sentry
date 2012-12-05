"""
sentry.webservers.cherrypy_server
~~~~~~~~~~~~~~~~~~~~

"""

from cherrypy import wsgiserver
import sentry.wsgi

def run_server(options):

    server = wsgiserver.CherryPyWSGIServer((options['host'], options['port']), sentry.wsgi.application,
        numthreads=options['workers'])
    try:
        print "Starting CherryPy server..."
        server.start()
    except KeyboardInterrupt:
        print "Shutting down CherryPy server..."
        server.stop()