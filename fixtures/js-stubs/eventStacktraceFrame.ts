import {Frame} from 'sentry/types';

export function EventStacktraceFrame(params = {}): Frame {
  return {
    filename: 'raven/base.py',
    absPath: '/home/ubuntu/.virtualenvs/getsentry/src/raven/raven/base.py',
    module: 'raven.base',
    package: null,
    platform: null,
    instructionAddr: null,
    symbolAddr: null,
    function: 'build_msg',
    rawFunction: null,
    symbol: null,
    context: [
      [298, '                frames = stack'],
      [299, ''],
      [300, '            data.update({'],
      [301, "                'sentry.interfaces.Stacktrace': {"],
      [302, "                    'frames': get_stack_info(frames,"],
      [303, '                        transformer=self.transform)'],
      [304, '                },'],
      [305, '            })'],
      [306, ''],
      [307, "        if 'sentry.interfaces.Stacktrace' in data:"],
      [308, '            if self.include_paths:'],
    ],
    lineNo: 303,
    colNo: null,
    inApp: true,
    trust: null,
    vars: {
      "'culprit'": null,
      "'data'": {
        "'message'": "u'This is a test message generated using ``raven test``'",
        "'sentry.interfaces.Message'": {
          "'message'": "u'This is a test message generated using ``raven test``'",
          "'params'": [],
        },
      },
      "'date'": 'datetime.datetime(2013, 8, 13, 3, 8, 24, 880386)',
      "'event_id'": "'54a322436e1b47b88e239b78998ae742'",
      "'event_type'": "'raven.events.Message'",
      "'extra'": {
        "'go_deeper'": [['{"\'bar\'":["\'baz\'"],"\'foo\'":"\'bar\'"}']],
        "'loadavg'": [0.37255859375, 0.5341796875, 0.62939453125],
        "'user'": "'dcramer'",
      },
      "'frames'": '<generator object iter_stack_frames at 0x107bcc3c0>',
      "'handler'": '<raven.events.Message object at 0x107bd0890>',
      "'k'": "'sentry.interfaces.Message'",
      "'kwargs'": {
        "'level'": 20,
        "'message'": "'This is a test message generated using ``raven test``'",
      },
      "'public_key'": null,
      "'result'": {
        "'message'": "u'This is a test message generated using ``raven test``'",
        "'sentry.interfaces.Message'": {
          "'message'": "u'This is a test message generated using ``raven test``'",
          "'params'": [],
        },
      },
      "'self'": '<raven.base.Client object at 0x107bb8210>',
      "'stack'": true,
      "'tags'": null,
      "'time_spent'": null,
      "'v'": {
        "'message'": "u'This is a test message generated using ``raven test``'",
        "'params'": [],
      },
    },
    ...params,
  };
}
