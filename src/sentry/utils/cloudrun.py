import google.auth.transport.requests
import google.oauth2.id_token


def fetch_id_token_for_service(service_url):
    auth_req = google.auth.transport.requests.Request()
    return google.oauth2.id_token.fetch_id_token(auth_req, service_url)
