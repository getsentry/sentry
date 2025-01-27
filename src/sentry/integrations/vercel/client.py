import logging

from requests import PreparedRequest

from sentry.integrations.client import ApiClient
from sentry.shared_integrations.client.proxy import IntegrationProxyClient, infer_org_integration
from sentry.shared_integrations.exceptions import ApiError
from sentry.silo.base import control_silo_function

logger = logging.getLogger("sentry.integrations.vercel.api")


class VercelClient(ApiClient):
    base_url = "https://api.vercel.com"
    integration_name = "vercel"
    pagination_limit = 100

    # Current User API (Read)
    # https://vercel.com/docs/integrations/reference#using-the-vercel-api/scopes/user
    GET_USER_URL = "/v2/user"

    # Teams API Scope (Read)
    # https://vercel.com/docs/rest-api#endpoints/teams/get-a-team
    GET_TEAM_URL = "/v2/teams/%s"

    # Projects API Scope (Read)
    # https://vercel.com/docs/rest-api#endpoints/projects/find-a-project-by-id-or-name
    GET_PROJECT_URL = "/v9/projects/%s"
    # https://vercel.com/docs/rest-api#endpoints/projects/retrieve-a-list-of-projects
    GET_PROJECTS_URL = "/v9/projects/"

    # Project Environment Variables API Scope (Read/Write)
    # https://vercel.com/docs/rest-api#endpoints/projects/retrieve-the-environment-variables-of-a-project-by-id-or-name
    GET_ENV_VAR_URL = "/v9/projects/%s/env"
    # https://vercel.com/docs/rest-api#endpoints/projects/create-one-or-more-environment-variables
    CREATE_ENV_VAR_URL = "/v9/projects/%s/env"
    # https://vercel.com/docs/rest-api#endpoints/projects/edit-an-environment-variable
    UPDATE_ENV_VAR_URL = "/v9/projects/%s/env/%s"

    # Integration Configuration API Scope (Read/Write)
    # https://vercel.com/docs/rest-api#endpoints/integrations/delete-an-integration-configuration
    UNINSTALL = "/v1/integrations/configuration/%s"

    def __init__(self, access_token, team_id=None):
        super().__init__()
        self.access_token = access_token
        self.team_id = team_id

    def request(self, method, path, data=None, params=None, allow_text=False):
        if self.team_id:
            # always need to use the team_id as a param for requests
            params = params or {}
            params["teamId"] = self.team_id
        headers = {"Authorization": f"Bearer {self.access_token}"}
        try:
            return self._request(
                method, path, headers=headers, data=data, params=params, allow_text=allow_text
            )
        except ApiError as e:
            if not e.code == 402:
                raise

    def get_team(self):
        assert self.team_id
        return self.get(self.GET_TEAM_URL % self.team_id)

    def get_user(self):
        return self.get(self.GET_USER_URL)["user"]

    def get_from_pagination(self, url, data_key):
        # Vercel Pagination Guide: https://vercel.com/docs/rest-api#introduction/api-basics/pagination
        params = {"limit": self.pagination_limit}
        results = []
        next_timestamp = ""
        while next_timestamp is not None:
            response = self.get(url, params=params)
            results += response[data_key]
            next_timestamp = response["pagination"]["next"]
            params["until"] = next_timestamp
        return results

    def get_projects(self):
        return self.get_from_pagination(self.GET_PROJECTS_URL, "projects")

    def get_project(self, vercel_project_id):
        return self.get(self.GET_PROJECT_URL % vercel_project_id)

    def get_env_vars(self, vercel_project_id):
        return self.get(self.GET_ENV_VAR_URL % vercel_project_id)

    def create_env_variable(self, vercel_project_id, data):
        return self.post(self.CREATE_ENV_VAR_URL % vercel_project_id, data=data)

    def update_env_variable(self, vercel_project_id, env_var_id, data):
        return self.patch(self.UPDATE_ENV_VAR_URL % (vercel_project_id, env_var_id), data=data)

    def uninstall(self, configuration_id):
        return self.delete(self.UNINSTALL % configuration_id)


class VercelProxyClient(IntegrationProxyClient):
    def __init__(self, integration_id: int, org_integration_id: int | None = None):
        if org_integration_id is None:
            org_integration_id = infer_org_integration(integration_id, logger)
        super().__init__(org_integration_id)

    @control_silo_function
    def authorize_request(self, prepared_request: PreparedRequest) -> PreparedRequest:
        # XXX(telemetry team): handle authentication
        pass


class VercelNativeClient(VercelProxyClient):
    base_url = "https://vercel.com/api"

    GET_INVOICE = "/v1/installations/%s/billing/invoices/%s"
    SUBMIT_INVOICE = "/v1/installations/%s/billing/invoices"
    SUBMIT_BILLING_DATA = "/v1/installations/%s/billing"

    def __init__(self, org_integration_id, integration_configuration_id):
        super().__init__(org_integration_id)
        self.integration_configuration_id = integration_configuration_id

    def get_invoice(self, invoice_id):
        """
        https://vercel.com/docs/integrations/marketplace-api#get-invoice
        """
        return self.get(self.GET_INVOICE % (self.integration_configuration_id, invoice_id))

    def submit_invoice(self, data):
        """
        https://vercel.com/docs/integrations/marketplace-api#submit-invoice
        """
        return self.post(self.SUBMIT_INVOICE % self.integration_id, data=data)

    def submit_billing_data(self, data):
        """
        https://vercel.com/docs/integrations/marketplace-api#submit-billing-data
        """
        return self.post(self.SUBMIT_BILLING_DATA % self.integration_id, data=data)
