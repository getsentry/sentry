# Code that is specific to a service driver goes in lib. Code that is specfic to a particular
# concrete implementation (API endpoint, asynchronous task) goes in their respective `endpoints`
# file to the tasks file. Code that should be re-used across multiple concrete implementations
# should be abstracted here.
#
# I.e. Fetching and serializing sentiment-analysis responses could live here. Scheduling
# sentiment-analysis tasks could live here.
