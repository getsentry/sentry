# Give users an hour to complete most integration/setup flows.
PIPELINE_STATE_TTL = 60 * 60

# Identity linking often waits on external SSO prompts (Azure AD, Okta, etc.),
# so keep the state alive much longer to avoid spurious invalid-state errors.
IDENTITY_PIPELINE_STATE_TTL = 6 * 60 * 60
