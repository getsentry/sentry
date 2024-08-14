import ipaddress

# Bitbucket Cloud IP range:
# https://confluence.atlassian.com/bitbucket/manage-webhooks-735643732.html#Managewebhooks-trigger_webhookTriggeringwebhooks
BITBUCKET_IP_RANGES = (
    # https://support.atlassian.com/bitbucket-cloud/docs/what-are-the-bitbucket-cloud-ip-addresses-i-should-use-to-configure-my-corporate-firewall/
    ipaddress.ip_network("104.192.136.0/21"),
    ipaddress.ip_network("185.166.140.0/22"),
    ipaddress.ip_network("18.205.93.0/25"),
    ipaddress.ip_network("18.234.32.128/25"),
    ipaddress.ip_network("13.52.5.0/25"),
    # Also accept any outbound IPs that atlassian has.
    # https://support.atlassian.com/organization-administration/docs/ip-addresses-and-domains-for-atlassian-cloud-products/
    # IPv4
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
    # IPv6
    ipaddress.ip_network("2401:1d80:3204:3::/64"),
    ipaddress.ip_network("2401:1d80:3204:4::/63"),
    ipaddress.ip_network("2401:1d80:3208:3::/64"),
    ipaddress.ip_network("2401:1d80:3208:4::/63"),
    ipaddress.ip_network("2401:1d80:3210:3::/64"),
    ipaddress.ip_network("2401:1d80:3210:4::/63"),
    ipaddress.ip_network("2401:1d80:3214:3::/64"),
    ipaddress.ip_network("2401:1d80:3214:4::/63"),
    ipaddress.ip_network("2401:1d80:321c:3::/64"),
    ipaddress.ip_network("2401:1d80:321c:4::/63"),
    ipaddress.ip_network("2401:1d80:3220:2::/63"),
    ipaddress.ip_network("2401:1d80:3224:3::/64"),
    ipaddress.ip_network("2401:1d80:3224:4::/63"),
    ipaddress.ip_network("2406:da18:809:e04::/63"),
    ipaddress.ip_network("2406:da18:809:e06::/64"),
    ipaddress.ip_network("2406:da1c:1e0:a204::/63"),
    ipaddress.ip_network("2406:da1c:1e0:a206::/64"),
    ipaddress.ip_network("2600:1f14:824:304::/63"),
    ipaddress.ip_network("2600:1f14:824:306::/64"),
    ipaddress.ip_network("2600:1f18:2146:e304::/63"),
    ipaddress.ip_network("2600:1f18:2146:e306::/64"),
    ipaddress.ip_network("2600:1f1c:cc5:2304::/63"),
    ipaddress.ip_network("2a05:d014:f99:dd04::/63"),
    ipaddress.ip_network("2a05:d014:f99:dd06::/64"),
    ipaddress.ip_network("2a05:d018:34d:5804::/63"),
    ipaddress.ip_network("2a05:d018:34d:5806::/64"),
)
BITBUCKET_IPS = ["34.198.203.127", "34.198.178.64", "34.198.32.85"]
