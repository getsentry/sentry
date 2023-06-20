import logging

from rest_framework.request import Request
from rest_framework.response import Response

from sentry.auth.view import AuthView, ConfigureView
from sentry.utils import json
from sentry.utils.signing import urlsafe_b64decode

from .client import FlyClient
from .constants import ERR_INVALID_DOMAIN, ERR_INVALID_RESPONSE

logger = logging.getLogger("sentry.auth.fly")


class FetchUser(AuthView):
    def __init__(self, domains, version, *args, **kwargs):
        self.domains = domains
        self.version = version
        super().__init__(*args, **kwargs)

    def handle(self, request: Request, helper) -> Response:
        with FlyClient(helper.fetch_state("data")["access_token"]) as client:
            # TODO: reference other providers and see how this is handled
            info = client.get_info()
            # TODO: determine how to handle the user data

            helper.bind_state("user", info)

            return helper.next_step()

    def dispatch(self, request: Request, helper) -> Response:
        """
        JSON response
            {
                "access_token"=>"fo1__034hk03k4mhjea0l4224hk",
                "token_type"=>"Bearer",
                "expires_in"=>7200,
                "refresh_token"=>"j-elry40hpy05m2qbaptr",
                "scope"=>"read",
                "created_at"=>1683733170
            }

        Finally, use this access token to issue an inline request to our token introspection endpoint.
        The response gives you enough information, for example, to authorize the user if they belong
        the correct parent organization in your system, or to provision the user and add them to
        these organizations.


        GET https://api.fly.io/oauth/token/info
        Authorization: Bearer fo1__034hk03k4mhjea0l4224hk
        """
        print("WITHIN FETCH USER DISPATCH")
        data = helper.fetch_state("data")

        try:
            access_token = data["access_token"]
        except KeyError:
            logger.error("Missing id_token in OAuth response: %s" % data)
            return helper.error(ERR_INVALID_RESPONSE)

        print("NEED TO MAKE A FINAL REQUEST TO TOKEN INTROSPECTION ENDPOINT")
        # try:
        #     _, payload, _ = map(urlsafe_b64decode, access_token)
        # except Exception as exc:
        #     logger.error("Unable to decode access_token: %s" % exc, exc_info=True)
        #     return helper.error(ERR_INVALID_RESPONSE)

        with FlyClient(helper.fetch_state("data")["access_token"]) as client:
            # if self.org is not None:
            #     if not client.is_org_member(self.org["id"]):
            #         return helper.error(ERR_NO_ORG_ACCESS)

            info = client.get_info()

            print("FETCHED USER INFO: ", info)

            helper.bind_state("user", info)

            return helper.next_step()

        # payload = "{}"

        # try:
        #     payload = json.loads(payload)
        # except Exception as exc:
        #     logger.error("Unable to decode id_token payload: %s" % exc, exc_info=True)
        #     return helper.error(ERR_INVALID_RESPONSE)

        # if not payload.get("email"):
        #     logger.error("Missing email in id_token payload: %s" % access_token)
        #     return helper.error(ERR_INVALID_RESPONSE)

        # support legacy style domains with pure domain regexp
        # if self.version is None:
        #     domain = extract_domain(payload["email"])
        # else:
        #     domain = payload.get("hd")

        # if domain is None:
        #     return helper.error(ERR_INVALID_DOMAIN % (domain,))

        # if self.domains and domain not in self.domains:
        #     return helper.error(ERR_INVALID_DOMAIN % (domain,))

        # helper.bind_state("domain", domain)
        # helper.bind_state("user", payload)

        # return helper.next_step()


class FlyConfigureView(ConfigureView):
    def dispatch(self, request: Request, organization, auth_provider):
        config = auth_provider.config
        if config.get("domain"):
            domains = [config["domain"]]
        else:
            domains = config.get("domains")
        return self.render("sentry_auth_fly/configure.html", {"domains": domains or []})


def extract_domain(email):
    return email.rsplit("@", 1)[-1]
