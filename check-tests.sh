tests=(
  "/Users/riccardobusetti/Sentry/sentry/tests/sentry/snuba/metrics/test_metrics_layer/test_metrics_enhanced_performance.py"
  "/Users/riccardobusetti/Sentry/sentry/tests/sentry/snuba/metrics/test_metrics_layer/test_release_health.py"
)

# shellcheck disable=SC2068
for i in {0..100}; do
  for test_path in ${tests[@]}; do
    py.test $test_path
  done
done
