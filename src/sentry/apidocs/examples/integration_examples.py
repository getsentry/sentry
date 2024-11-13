from drf_spectacular.utils import OpenApiExample


class IntegrationExamples:
    LIST_INTEGRATIONS = [
        OpenApiExample(
            "List All Available Integrations for Alphabet Soup Factory",
            value=[
                {
                    "id": "24817",
                    "name": "Alphabet Soup Factory",
                    "icon": "https://avatars.slack-edge.com/alphabet-soup",
                    "domainName": "alphabet-soup.slack.com",
                    "accountType": None,
                    "scopes": [
                        "channels:read",
                        "chat:write",
                        "chat:write.customize",
                        "chat:write.public",
                        "commands",
                        "groups:read",
                        "im:history",
                        "im:read",
                        "links:read",
                        "links:write",
                        "team:read",
                        "users:read",
                    ],
                    "status": "active",
                    "provider": {
                        "key": "slack",
                        "slug": "slack",
                        "name": "Slack",
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["alert-rule", "chat-unfurl"],
                        "aspects": {
                            "alerts": [
                                {
                                    "type": "info",
                                    "text": "The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.",
                                }
                            ]
                        },
                    },
                    "configOrganization": [],
                    "configData": {"installationType": "born_as_bot"},
                    "externalId": "7252394",
                    "organizationId": 6234528,
                    "organizationIntegrationStatus": "active",
                    "gracePeriodEnd": None,
                }
            ],
            status_codes=["200"],
            response_only=True,
        )
    ]

    GET_INTEGRATION = [
        OpenApiExample(
            "List All Available Integrations for Alphabet Soup Factory",
            value={
                "id": "24817",
                "name": "Alphabet Soup Factory",
                "icon": "https://avatars.slack-edge.com/alphabet-soup",
                "domainName": "alphabet-soup.slack.com",
                "accountType": None,
                "scopes": [
                    "channels:read",
                    "chat:write",
                    "chat:write.customize",
                    "chat:write.public",
                    "commands",
                    "groups:read",
                    "im:history",
                    "im:read",
                    "links:read",
                    "links:write",
                    "team:read",
                    "users:read",
                ],
                "status": "active",
                "provider": {
                    "key": "slack",
                    "slug": "slack",
                    "name": "Slack",
                    "canAdd": True,
                    "canDisable": False,
                    "features": ["alert-rule", "chat-unfurl"],
                    "aspects": {
                        "alerts": [
                            {
                                "type": "info",
                                "text": "The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.",
                            }
                        ]
                    },
                },
                "configOrganization": [],
                "configData": {"installationType": "born_as_bot"},
                "externalId": "7252394",
                "organizationId": 6234528,
                "organizationIntegrationStatus": "active",
                "gracePeriodEnd": None,
            },
            status_codes=["200"],
            response_only=True,
        )
    ]

    EXTERNAL_USER_CREATE = [
        OpenApiExample(
            "Create an external user",
            value={
                "externalName": "@Billybob",
                "provider": "github",
                "userId": "1",
                "integrationId": "1",
                "id": "1",
            },
            status_codes=["200", "201"],
            response_only=True,
        )
    ]

    EXTERNAL_TEAM_CREATE = [
        OpenApiExample(
            "Create an external team",
            value={
                "externalId": "asdf",
                "externalName": "@team-foo",
                "provider": "slack",
                "integrationId": "1",
                "id": "1",
                "teamId": "2",
            },
            status_codes=["200", "201"],
            response_only=True,
        )
    ]

    ORGANIZATION_CONFIG_INTEGRATIONS = [
        OpenApiExample(
            "Get integration provider information about all available integrations for Alphabet Soup Factory",
            value={
                "providers": [
                    {
                        "key": "aws_lambda",
                        "slug": "aws_lambda",
                        "name": "AWS Lambda",
                        "metadata": {
                            "description": "The AWS Lambda integration will automatically instrument your Lambda functions without any code changes. We use CloudFormation Stack ([Learn more about CloudFormation](https://aws.amazon.com/cloudformation/)) to create Sentry role and enable errors and transactions capture from your Lambda functions.",
                            "features": [
                                {
                                    "description": "Instrument your serverless code automatically.",
                                    "featureGate": "integrations-serverless",
                                }
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=AWS%20Lambda%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/aws_lambda",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["serverless"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/aws_lambda/setup/",
                            "width": 600,
                            "height": 600,
                        },
                    },
                    {
                        "key": "bitbucket",
                        "slug": "bitbucket",
                        "name": "Bitbucket",
                        "metadata": {
                            "description": "Connect your Sentry organization to Bitbucket, enabling the following features:",
                            "features": [
                                {
                                    "description": "Track commits and releases (learn more\n        [here](https://docs.sentry.io/learn/releases/))",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Resolve Sentry issues via Bitbucket commits by\n        including `Fixes PROJ-ID` in the message",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Create Bitbucket issues from Sentry",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Link Sentry issues to existing Bitbucket issues",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Link your Sentry stack traces back to your Bitbucket source code with stack\n        trace linking.",
                                    "featureGate": "integrations-stacktrace-link",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Bitbucket%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["issue-basic", "commits", "stacktrace-link"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/bitbucket/setup/",
                            "width": 600,
                            "height": 600,
                        },
                    },
                    {
                        "key": "bitbucket_server",
                        "slug": "bitbucket_server",
                        "name": "Bitbucket Server",
                        "metadata": {
                            "description": "Connect your Sentry organization to Bitbucket Server, enabling the following features:",
                            "features": [
                                {
                                    "description": "Track commits and releases (learn more\n        [here](https://docs.sentry.io/learn/releases/))",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Resolve Sentry issues via Bitbucket Server commits by\n        including `Fixes PROJ-ID` in the message",
                                    "featureGate": "integrations-commits",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Bitbucket%20Server%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/bitbucket_server",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["commits"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/bitbucket_server/setup/",
                            "width": 1030,
                            "height": 1000,
                        },
                    },
                    {
                        "key": "discord",
                        "slug": "discord",
                        "name": "Discord",
                        "metadata": {
                            "description": "Discord’s your place to collaborate, share, and just talk about your day – or\ncommiserate about app errors. Connect Sentry to your Discord server and get\n[alerts](https://docs.sentry.io/product/alerts/alert-types/) in a channel of your choice or via\ndirect message when sh%t hits the fan.",
                            "features": [
                                {
                                    "description": "Assign, ignore, and resolve issues by interacting with chat messages.",
                                    "featureGate": "integrations-chat-unfurl",
                                },
                                {
                                    "description": "Configure rule based Discord notifications to automatically be posted into a specific channel.",
                                    "featureGate": "integrations-alert-rule",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Discord%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/discord",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["chat-unfurl", "alert-rule"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/discord/setup/",
                            "width": 600,
                            "height": 900,
                        },
                    },
                    {
                        "key": "github",
                        "slug": "github",
                        "name": "GitHub",
                        "metadata": {
                            "description": "Connect your Sentry organization into your GitHub organization or user account.\nTake a step towards augmenting your sentry issues with commits from your\nrepositories ([using releases](https://docs.sentry.io/learn/releases/)) and\nlinking up your GitHub issues and pull requests directly to issues in Sentry.",
                            "features": [
                                {
                                    "description": "Authorize repositories to be added to your Sentry organization to augment\n        sentry issues with commit data with [deployment\n        tracking](https://docs.sentry.io/learn/releases/).",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Create and link Sentry issue groups directly to a GitHub issue or pull\n        request in any of your repositories, providing a quick way to jump from\n        Sentry bug to tracked issue or PR!",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Link your Sentry stack traces back to your GitHub source code with stack\n        trace linking.",
                                    "featureGate": "integrations-stacktrace-link",
                                },
                                {
                                    "description": "Import your GitHub [CODEOWNERS file](https://docs.sentry.io/product/integrations/source-code-mgmt/github/#code-owners) and use it alongside your ownership rules to assign Sentry issues.",
                                    "featureGate": "integrations-codeowners",
                                },
                                {
                                    "description": "Automatically create GitHub issues based on Issue Alert conditions.",
                                    "featureGate": "integrations-ticket-rules",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["issue-basic", "commits", "codeowners", "stacktrace-link"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/github/setup/",
                            "width": 1030,
                            "height": 1000,
                        },
                    },
                    {
                        "key": "github_enterprise",
                        "slug": "github_enterprise",
                        "name": "GitHub Enterprise",
                        "metadata": {
                            "description": "Connect your Sentry organization into your on-premises GitHub Enterprise\ninstances. Take a step towards augmenting your sentry issues with commits from\nyour repositories ([using releases](https://docs.sentry.io/learn/releases/))\nand linking up your GitHub issues and pull requests directly to issues in\nSentry.",
                            "features": [
                                {
                                    "description": "Authorize repositories to be added to your Sentry organization to augment\n        sentry issues with commit data with [deployment\n        tracking](https://docs.sentry.io/learn/releases/).",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Create and link Sentry issue groups directly to a GitHub issue or pull\n        request in any of your repositories, providing a quick way to jump from\n        Sentry bug to tracked issue or PR!",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Link your Sentry stack traces back to your GitHub source code with stack\n        trace linking.",
                                    "featureGate": "integrations-stacktrace-link",
                                },
                                {
                                    "description": "Import your GitHub [CODEOWNERS file](https://docs.sentry.io/product/integrations/source-code-mgmt/github/#code-owners) and use it alongside your ownership rules to assign Sentry issues.",
                                    "featureGate": "integrations-codeowners",
                                },
                                {
                                    "description": "Automatically create GitHub issues based on Issue Alert conditions.",
                                    "featureGate": "integrations-ticket-rules",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitHub%20Enterprise%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/github_enterprise",
                            "aspects": {
                                "disable_dialog": {
                                    "actionText": "Visit GitHub Enterprise",
                                    "body": "Before deleting this integration, you must uninstall it from your GitHub Enterprise instance. After uninstalling, your integration will be disabled at which point you can choose to delete this integration.",
                                },
                                "removal_dialog": {
                                    "actionText": "Delete",
                                    "body": "Deleting this integration will delete all associated repositories and commit data. This action cannot be undone. Are you sure you want to delete your integration?",
                                },
                                "alerts": [
                                    {
                                        "type": "warning",
                                        "icon": "icon-warning-sm",
                                        "text": "Your GitHub enterprise instance must be able to communicate with Sentry. Before you proceed, make sure that connections from [the static set of IP addresses that Sentry makes outbound requests from](https://docs.sentry.io/product/security/ip-ranges/#outbound-requests) are allowed in your firewall.",
                                    }
                                ],
                            },
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["issue-basic", "commits", "codeowners", "stacktrace-link"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/github_enterprise/setup/",
                            "width": 1030,
                            "height": 1000,
                        },
                    },
                    {
                        "key": "gitlab",
                        "slug": "gitlab",
                        "name": "GitLab",
                        "metadata": {
                            "description": "Connect your Sentry organization to an organization in your GitLab instance or gitlab.com, enabling the following features:",
                            "features": [
                                {
                                    "description": "Track commits and releases (learn more\n        [here](https://docs.sentry.io/learn/releases/))",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Resolve Sentry issues via GitLab commits and merge requests by\n        including `Fixes PROJ-ID` in the message",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Create GitLab issues from Sentry",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Link Sentry issues to existing GitLab issues",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Link your Sentry stack traces back to your GitLab source code with stack\n        trace linking.",
                                    "featureGate": "integrations-stacktrace-link",
                                },
                                {
                                    "description": "Import your GitLab [CODEOWNERS file](https://docs.sentry.io/product/integrations/source-code-mgmt/gitlab/#code-owners) and use it alongside your ownership rules to assign Sentry issues.",
                                    "featureGate": "integrations-codeowners",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=GitLab%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/gitlab",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["issue-basic", "commits", "codeowners", "stacktrace-link"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/gitlab/setup/",
                            "width": 1030,
                            "height": 1000,
                        },
                    },
                    {
                        "key": "jira",
                        "slug": "jira",
                        "name": "Jira",
                        "metadata": {
                            "description": "Connect your Sentry organization into one or more of your Jira cloud instances.\nGet started streamlining your bug squashing workflow by unifying your Sentry and\nJira instances together.",
                            "features": [
                                {
                                    "description": "Create and link Sentry issue groups directly to a Jira ticket in any of your\n        projects, providing a quick way to jump from a Sentry bug to tracked ticket!",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Automatically synchronize assignees to and from Jira. Don't get confused\n        who's fixing what, let us handle ensuring your issues and tickets match up\n        to your Sentry and Jira assignees.",
                                    "featureGate": "integrations-issue-sync",
                                },
                                {
                                    "description": "Synchronize Comments on Sentry Issues directly to the linked Jira ticket.",
                                    "featureGate": "integrations-issue-sync",
                                },
                                {
                                    "description": "Automatically create Jira tickets based on Issue Alert conditions.",
                                    "featureGate": "integrations-ticket-rules",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Instance",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Jira%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira",
                            "aspects": {
                                "externalInstall": {
                                    "url": "https://marketplace.atlassian.com/apps/1219432/sentry-for-jira",
                                    "buttonText": "Jira Marketplace",
                                    "noticeText": "Visit the Jira Marketplace to install this integration. After installing the\nSentry add-on, access the settings panel in your Jira instance to enable the\nintegration for this Organization.",
                                }
                            },
                        },
                        "canAdd": False,
                        "canDisable": False,
                        "features": ["issue-basic", "ticket-rules", "issue-sync"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/jira/setup/",
                            "width": 600,
                            "height": 600,
                        },
                    },
                    {
                        "key": "jira_server",
                        "slug": "jira_server",
                        "name": "Jira Server",
                        "metadata": {
                            "description": "Connect your Sentry organization into one or more of your Jira Server instances.\nGet started streamlining your bug squashing workflow by unifying your Sentry and\nJira instances together.",
                            "features": [
                                {
                                    "description": "Create and link Sentry issue groups directly to a Jira ticket in any of your\n        projects, providing a quick way to jump from Sentry bug to tracked ticket!",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Automatically synchronize assignees to and from Jira. Don't get confused\n        who's fixing what, let us handle ensuring your issues and tickets match up\n        to your Sentry and Jira assignees.",
                                    "featureGate": "integrations-issue-sync",
                                },
                                {
                                    "description": "Synchronize Comments on Sentry Issues directly to the linked Jira ticket.",
                                    "featureGate": "integrations-issue-sync",
                                },
                                {
                                    "description": "Automatically create Jira tickets based on Issue Alert conditions.",
                                    "featureGate": "integrations-ticket-rules",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Jira%20Server%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/jira_server",
                            "aspects": {
                                "alerts": [
                                    {
                                        "type": "warning",
                                        "icon": "icon-warning-sm",
                                        "text": "Your Jira instance must be able to communicate with Sentry. Sentry makes outbound requests from a [static set of IP addresses](https://docs.sentry.io/ip-ranges/) that you may wish to allow in your firewall to support this integration.",
                                    }
                                ]
                            },
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["issue-basic", "issue-sync"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/jira_server/setup/",
                            "width": 1030,
                            "height": 1000,
                        },
                    },
                    {
                        "key": "msteams",
                        "slug": "msteams",
                        "name": "Microsoft Teams",
                        "metadata": {
                            "description": "Microsoft Teams is a hub for teamwork in Office 365. Keep all your team's chats, meetings, files, and apps together in one place.\n\nGet [alerts](https://docs.sentry.io/product/alerts-notifications/alerts/) that let you assign, ignore, and resolve issues right in your Teams channels with the Sentry integration for Microsoft Teams.",
                            "features": [
                                {
                                    "description": "Interact with messages in the chat to assign, ignore, and resolve issues.",
                                    "featureGate": "integrations-chat-unfurl",
                                },
                                {
                                    "description": "Configure rule based Teams alerts to automatically be posted into a specific channel or user.",
                                    "featureGate": "integrations-alert-rule",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Microsoft%20Teams%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/msteams",
                            "aspects": {
                                "externalInstall": {
                                    "url": "https://teams.microsoft.com/l/app/5adee720-30de-4006-a342-d454317db1d4",
                                    "buttonText": "Teams Marketplace",
                                    "noticeText": "Visit the Teams Marketplace to install this integration. After adding the integration to your team, you will get a welcome message in the General channel to complete installation.",
                                }
                            },
                        },
                        "canAdd": False,
                        "canDisable": False,
                        "features": ["chat-unfurl", "alert-rule"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/msteams/setup/",
                            "width": 600,
                            "height": 600,
                        },
                    },
                    {
                        "key": "opsgenie",
                        "slug": "opsgenie",
                        "name": "Opsgenie",
                        "metadata": {
                            "description": "Trigger alerts in Opsgenie from Sentry.\n\nOpsgenie is a cloud-based service for dev and ops teams, providing reliable alerts, on-call schedule management, and escalations.\nOpsgenie integrates with monitoring tools and services to ensure that the right people are notified via email, SMS, phone, and iOS/Android push notifications.",
                            "features": [
                                {
                                    "description": "Manage incidents and outages by sending Sentry notifications to Opsgenie.",
                                    "featureGate": "integrations-enterprise-incident-management",
                                },
                                {
                                    "description": "Configure rule based Opsgenie alerts that automatically trigger and notify specific teams.",
                                    "featureGate": "integrations-enterprise-alert-rule",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/opsgenie",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["incident-management", "alert-rule"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/opsgenie/setup/",
                            "width": 600,
                            "height": 600,
                        },
                    },
                    {
                        "key": "pagerduty",
                        "slug": "pagerduty",
                        "name": "PagerDuty",
                        "metadata": {
                            "description": "Connect your Sentry organization with one or more PagerDuty accounts, and start getting\nincidents triggered from Sentry alerts.",
                            "features": [
                                {
                                    "description": "Manage incidents and outages by sending Sentry notifications to PagerDuty.",
                                    "featureGate": "integrations-incident-management",
                                },
                                {
                                    "description": "Configure rule based PagerDuty alerts to automatically be triggered in a specific\n        service - or in multiple services!",
                                    "featureGate": "integrations-alert-rule",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=PagerDuty%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/pagerduty",
                            "aspects": {
                                "alerts": [
                                    {
                                        "type": "info",
                                        "text": "The PagerDuty integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to PagerDuty you must create a rule using the PagerDuty action in your project settings.",
                                    }
                                ]
                            },
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["incident-management", "alert-rule"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/pagerduty/setup/",
                            "width": 600,
                            "height": 900,
                        },
                    },
                    {
                        "key": "slack",
                        "slug": "slack",
                        "name": "Slack",
                        "metadata": {
                            "description": "Connect your Sentry organization to one or more Slack workspaces, and start\ngetting errors right in front of you where all the action happens in your\noffice!",
                            "features": [
                                {
                                    "description": "Unfurls Sentry URLs directly within Slack, providing you context and\n        actionability on issues right at your fingertips. Resolve, ignore, and assign issues with minimal context switching.",
                                    "featureGate": "integrations-chat-unfurl",
                                },
                                {
                                    "description": "Configure rule based Slack notifications to automatically be posted into a\n        specific channel. Want any error that's happening more than 100 times a\n        minute to be posted in `#critical-errors`? Setup a rule for it!",
                                    "featureGate": "integrations-alert-rule",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Workspace",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Slack%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/slack",
                            "aspects": {
                                "alerts": [
                                    {
                                        "type": "info",
                                        "text": "The Slack integration adds a new Alert Rule action to all projects. To enable automatic notifications sent to Slack you must create a rule using the slack workspace action in your project settings.",
                                    }
                                ]
                            },
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": ["chat-unfurl", "alert-rule"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/slack/setup/",
                            "width": 600,
                            "height": 900,
                        },
                    },
                    {
                        "key": "vercel",
                        "slug": "vercel",
                        "name": "Vercel",
                        "metadata": {
                            "description": "Vercel is an all-in-one platform with Global CDN supporting static & JAMstack deployment and Serverless Functions.",
                            "features": [
                                {
                                    "description": "Connect your Sentry and Vercel projects to automatically upload source maps and notify Sentry of new releases being deployed.",
                                    "featureGate": "integrations-deployment",
                                }
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Vercel%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vercel",
                            "aspects": {
                                "externalInstall": {
                                    "url": "https://vercel.com/integrations/sentry/add",
                                    "buttonText": "Vercel Marketplace",
                                    "noticeText": "Visit the Vercel Marketplace to install this integration. After installing the Sentry integration, you'll be redirected back to Sentry to finish syncing Vercel and Sentry projects.",
                                },
                                "configure_integration": {"title": "Connect Your Projects"},
                            },
                        },
                        "canAdd": False,
                        "canDisable": False,
                        "features": ["deployment"],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/vercel/setup/",
                            "width": 600,
                            "height": 600,
                        },
                    },
                    {
                        "key": "vsts",
                        "slug": "vsts",
                        "name": "Azure DevOps",
                        "metadata": {
                            "description": "Connect your Sentry organization to one or more of your Azure DevOps\norganizations. Get started streamlining your bug squashing workflow by unifying\nyour Sentry and Azure DevOps organization together.",
                            "features": [
                                {
                                    "description": "Authorize repositories to be added to your Sentry organization to augment\n        sentry issues with commit data with [deployment\n        tracking](https://docs.sentry.io/learn/releases/).",
                                    "featureGate": "integrations-commits",
                                },
                                {
                                    "description": "Create and link Sentry issue groups directly to a Azure DevOps work item in any of\n        your projects, providing a quick way to jump from Sentry bug to tracked\n        work item!",
                                    "featureGate": "integrations-issue-basic",
                                },
                                {
                                    "description": "Automatically synchronize comments and assignees to and from Azure DevOps. Don't get\n        confused who's fixing what, let us handle ensuring your issues and work\n        items match up to your Sentry and Azure DevOps assignees.",
                                    "featureGate": "integrations-issue-sync",
                                },
                                {
                                    "description": "Never forget to close a resolved workitem! Resolving an issue in Sentry\n        will resolve your linked workitems and vice versa.",
                                    "featureGate": "integrations-issue-sync",
                                },
                                {
                                    "description": "Link your Sentry stack traces back to your Azure DevOps source code with stack\n        trace linking.",
                                    "featureGate": "integrations-stacktrace-link",
                                },
                                {
                                    "description": "Automatically create Azure DevOps work items based on Issue Alert conditions.",
                                    "featureGate": "integrations-ticket-rules",
                                },
                            ],
                            "author": "The Sentry Team",
                            "noun": "Installation",
                            "issue_url": "https://github.com/getsentry/sentry/issues/new?assignees=&labels=Component:%20Integrations&template=bug.yml&title=Azure%20DevOps%20Integration%20Problem",
                            "source_url": "https://github.com/getsentry/sentry/tree/master/src/sentry/integrations/vsts",
                            "aspects": {},
                        },
                        "canAdd": True,
                        "canDisable": False,
                        "features": [
                            "ticket-rules",
                            "stacktrace-link",
                            "issue-sync",
                            "commits",
                            "issue-basic",
                        ],
                        "setupDialog": {
                            "url": "/organizations/devsentry-ecosystem/integrations/vsts/setup/",
                            "width": 600,
                            "height": 800,
                        },
                    },
                ]
            },
            status_codes=["200"],
            response_only=True,
        )
    ]
