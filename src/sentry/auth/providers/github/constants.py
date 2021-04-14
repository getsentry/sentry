from django.conf import settings

CLIENT_ID = settings.GITHUB_APP_ID

CLIENT_SECRET = settings.GITHUB_API_SECRET

REQUIRE_VERIFIED_EMAIL = settings.GITHUB_REQUIRE_VERIFIED_EMAIL

ERR_NO_ORG_ACCESS = "You do not have access to the required GitHub organization."

ERR_NO_PRIMARY_EMAIL = (
    "We were unable to find a primary email address associated with your GitHub account."
)

ERR_NO_SINGLE_PRIMARY_EMAIL = (
    "We were unable to find a single primary email address associated with your GitHub account."
)

ERR_NO_VERIFIED_PRIMARY_EMAIL = (
    "We were unable to find a verified, primary email address associated with your GitHub account."
)

ERR_NO_SINGLE_VERIFIED_PRIMARY_EMAIL = "We were unable to find a single verified, primary email address associated with your GitHub account."

# we request repo as we share scopes with the other GitHub integration
SCOPE = "user:email,read:org,repo"

# deprecated please use GITHUB_API_DOMAIN and GITHUB_BASE_DOMAIN
DOMAIN = getattr(settings, "GITHUB_DOMAIN", "api.github.com")

BASE_DOMAIN = settings.GITHUB_BASE_DOMAIN
API_DOMAIN = settings.GITHUB_API_DOMAIN

ACCESS_TOKEN_URL = f"https://{BASE_DOMAIN}/login/oauth/access_token"
AUTHORIZE_URL = f"https://{BASE_DOMAIN}/login/oauth/authorize"
