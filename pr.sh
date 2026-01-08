#!/bin/bash

for COMMIT in $(git log --pretty=format:"%H" -n1 7e4ab7ade2307f17c53a8e990fdbb5b9ffc02092); do
  echo "Triggering workflow for commit $COMMIT..."
  curl -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GH_PAT" \
    https://api.github.com/repos/getsentry/sentry/actions/workflows/backend-dynamic-sharding-trial.yml/dispatches \
    -d "{\"ref\":\"dynamic-sharding-trial\", \"inputs\": {\"commit_sha\":\"$COMMIT\"}}"
done
