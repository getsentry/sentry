def parse_addr(x):
    if x is None:
        return 0
    if isinstance(x, (int, long)):
        return x
    if isinstance(x, basestring):
        if x[:2] == '0x':
            return int(x[2:], 16)
        return int(x)
    raise ValueError('Unsupported address format %r' % (x,))
