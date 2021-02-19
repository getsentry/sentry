#!/bin/bash
# Module containing code shared across various shell scripts

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" || exit 1; pwd -P)"
# shellcheck source=lib.sh
source "${HERE}/lib.sh"

# Based on https://stackoverflow.com/a/4025065
# https://creativecommons.org/licenses/by-sa/3.0/
# Author: Dennis Williamson
# Modifications: We check return value instead of relation symbol
testvercomp () {
    vercomp $1 $2
    _result=$?
    if [[ $_result != $3 ]]; then
        echo "FAIL - Result: $_result - $1 vs $2 (Expected: $3)"
    else
        echo "PASS"
    fi
}

# Run tests
# argument table format:
# testarg1   testarg2     expected_return_value
echo "The following tests should pass"
while read -r test
do
    testvercomp $test
done << EOF
1            1            0
2.1          2.2          2
3.0.4.10     3.0.4.2      1
4.08         4.08.01      2
3.2.1.9.8144 3.2          1
3.2          3.2.1.9.8144 2
1.2          2.1          2
2.1          1.2          1
5.6.7        5.6.7        0
1.01.1       1.1.1        0
1.1.1        1.01.1       0
1            1.0          0
1.0          1            0
1.0.2.0      1.0.2        0
1..0         1.0          0
1.0          1..0         0
EOF

echo "The following test should fail (test the tester)"
testvercomp 1 1 1
