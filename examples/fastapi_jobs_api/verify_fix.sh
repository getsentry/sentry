#!/bin/bash
# Verification script for the FastAPI Jobs API fix

set -e

echo "=========================================="
echo "FastAPI Jobs API - Fix Verification"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "main.py" ]; then
    echo "❌ Error: Please run this script from /workspace/examples/fastapi_jobs_api"
    exit 1
fi

echo "✓ Located in correct directory"
echo ""

# Check Python installation
echo "Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Python found: $PYTHON_VERSION"
else
    echo "❌ Python3 not found"
    exit 1
fi
echo ""

# Check dependencies
echo "Checking dependencies..."
MISSING_DEPS=0

for pkg in fastapi uvicorn pydantic pytest httpx; do
    if python3 -c "import $pkg" 2>/dev/null; then
        echo "✓ $pkg installed"
    else
        echo "❌ $pkg not installed"
        MISSING_DEPS=1
    fi
done

if [ $MISSING_DEPS -eq 1 ]; then
    echo ""
    echo "Installing missing dependencies..."
    python3 -m pip install -q -r requirements.txt
    echo "✓ Dependencies installed"
fi
echo ""

# Run tests
echo "Running test suite..."
echo "=========================================="
PYTHONPATH=/workspace/examples/fastapi_jobs_api python3 -m pytest test_main.py -v --tb=short

if [ $? -eq 0 ]; then
    echo ""
    echo "=========================================="
    echo "✅ All tests passed!"
    echo "=========================================="
    echo ""
    echo "The fix is verified and working correctly:"
    echo "  ✓ Endpoint properly implemented"
    echo "  ✓ No 501 errors"
    echo "  ✓ No cascading to 500 errors"
    echo "  ✓ Global error handling working"
    echo "  ✓ Request tracking enabled"
    echo ""
    echo "To run the application:"
    echo "  uvicorn main:app --reload"
    echo ""
    echo "To view API docs:"
    echo "  http://localhost:8000/docs"
    echo ""
else
    echo ""
    echo "❌ Tests failed"
    exit 1
fi
