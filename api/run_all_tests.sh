#!/bin/bash
# Run all tests for the jobs API bug fix

echo "========================================================================"
echo "Running all tests for the Jobs API bug fix"
echo "========================================================================"
echo ""

FAILED=0

echo "Test 1: Unit tests for normalize_job_data function"
echo "------------------------------------------------------------------------"
python3 api/test_fix.py
if [ $? -ne 0 ]; then
    FAILED=1
fi
echo ""

echo "Test 2: Full API endpoint integration tests"
echo "------------------------------------------------------------------------"
python3 api/test_api_endpoint.py
if [ $? -ne 0 ]; then
    FAILED=1
fi
echo ""

echo "Test 3: Exact error scenario from Sentry report"
echo "------------------------------------------------------------------------"
python3 api/test_exact_error_scenario.py
if [ $? -ne 0 ]; then
    FAILED=1
fi
echo ""

echo "========================================================================"
if [ $FAILED -eq 0 ]; then
    echo "✓ ALL TESTS PASSED"
    echo "========================================================================"
    echo ""
    echo "Summary:"
    echo "  - The bug is completely fixed"
    echo "  - All location formats (string and dict) are handled correctly"
    echo "  - The API returns proper responses without errors"
    echo "  - HTTPException 'dict' object has no attribute 'lower' is resolved"
    exit 0
else
    echo "✗ SOME TESTS FAILED"
    echo "========================================================================"
    exit 1
fi
