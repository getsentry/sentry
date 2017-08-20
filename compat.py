try:                # Python 2
    reduce
except NameError:   # Python 3
    from functools import reduce

try:
    xrange          # Python 2
except NameError:
    xrange = range  # Python 3
