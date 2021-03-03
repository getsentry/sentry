These docs are specific to a Splunk Cloud (self-service) instance. For more details on the HEC endpoint, see the `official docs <https://docs.splunk.com/Documentation/Splunk/latest/Data/UsetheHTTPEventCollector#Send_data_to_HTTP_Event_Collector_on_Splunk_Cloud_instances>`_.

- In your Splunk instance, navigate to Settings -> Data Inputs -> HTTP Event Collector
- Create a new token; enter a name ("sentry") and select an index ("main")
- Under Global Settings, Enable the HEC endpoint noting the port (8088), and SSL requirement (true)
- In Sentry, enable the Splunk plugin, and paste the newly acquired token.
- For the endpoint, use https://input-[splunk-instance].cloud.splunk.com:8088
- Ensure that `enable indexer acknowledgement` is not checked.
