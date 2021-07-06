import ipaddress

# Bitbucket Cloud IP range:
# https://confluence.atlassian.com/bitbucket/manage-webhooks-735643732.html#Managewebhooks-trigger_webhookTriggeringwebhooks
BITBUCKET_IP_RANGES = (
    ipaddress.ip_network("104.192.136.0/21"),
    # Not documented in the webhook docs, but defined here:
    # https://bitbucket.org/blog/new-ip-addresses-bitbucket-cloud
    ipaddress.ip_network("18.205.93.0/25"),
    ipaddress.ip_network("18.234.32.128/25"),
    ipaddress.ip_network("13.52.5.0/25"),
    # Also accept any outbound IPs that atlassian has.
    # https://support.atlassian.com/organization-administration/docs/ip-addresses-and-domains-for-atlassian-cloud-products/
    ipaddress.ip_network("13.52.5.96/28"),
    ipaddress.ip_network("13.236.8.224/28"),
    ipaddress.ip_network("18.136.214.96/28"),
    ipaddress.ip_network("18.184.99.224/28"),
    ipaddress.ip_network("18.234.32.224/28"),
    ipaddress.ip_network("18.246.31.224/28"),
    ipaddress.ip_network("52.215.192.224/28"),
    ipaddress.ip_network("104.192.137.240/28"),
    ipaddress.ip_network("104.192.138.240/28"),
    ipaddress.ip_network("104.192.140.240/28"),
    ipaddress.ip_network("104.192.142.240/28"),
    ipaddress.ip_network("104.192.143.240/28"),
    ipaddress.ip_network("185.166.143.240/28"),
    ipaddress.ip_network("185.166.142.240/28"),
)
BITBUCKET_IPS = ["34.198.203.127", "34.198.178.64", "34.198.32.85"]
