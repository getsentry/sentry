class NotifyDisable():

    def get_url(organization: Organization, provider_type: str, provider_slug: str) -> str:
        type_name = provider_types.get(provider_type, "")
        return str(
            organization.absolute_url(
                f"/settings/{organization.slug}/{type_name}/{provider_slug}/",
                query="referrer=request_email",
            )
        )


    def notifyDisable(self, organization, integration, project = None):

        integration_name = integration.provider
        integration_link = get_url(
            organization,
            integration.provider_type,
            integration.provider_slug,
        )
        MessageBuilder(context={"integration_name":integration_name,
            "integration_link":integration_link,
            "settings_link":settings_link
            }).render(request))
