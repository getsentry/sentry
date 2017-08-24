## Webserver

1. Setup an API application
2. Add ``http://127.0.0.1:5000/authorized`` as an Authorized Redirect URI
3. Launch the service:

    BASE_URL=http://dev.getsentry.net:8000 \
    CLIENT_ID=XXX \
    CLIENT_SECRET=XXX \
    python app.py
