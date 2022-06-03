def get_provider_by_user_agent(user_agent):
    user_agent = user_agent.lower()
    for keyword, provider in [
        (
            "telegram",
            "telegram",
        ),  # User-agent is "TelegramBot (like TwitterBot)" so it must go before Twitter
        ("twitter", "twitter"),
        ("notion", "notion"),
        ("atlassian", "atlassian"),  # Could be trello or jira
        ("discord", "discord"),
        ("slack", "slack"),
        ("skype", "msteams"),
        ("reddit", "reddit"),
        ("facebook", "facebook"),
        ("quora", "quora"),
        ("linkedin", "linkedin"),
        ("iframely", "iframely"),  # Generic embedding framework
        ("embedly", "embedly"),  # Generic embedding framework
    ]:
        if keyword in user_agent:
            return provider
    return None


# Providers that we have an integration
META_PROVIDER_TO_INTEGRATIONS = {
    "atlassian": "Jira/Trello",
    "slack": "Slack",
    "msteams": "Microsoft Teams",
}

# Providers that are considered public facing
META_PUBLIC_PROVIDERS = [
    "twitter",
    "reddit",
    "linkedin",
    "facebook",
    "quora",
]
