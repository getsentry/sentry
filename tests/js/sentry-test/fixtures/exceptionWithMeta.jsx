function ExceptionWithMeta(props = {}) {
  return {
    level: 'error',
    platform: 'python',
    exception: {
      values: [
        {
          type: 'ValueError',
          value: 'python err A949AE01EBB07300D62AE0178F0944DD21F8C98C err',
          module: 'exceptions',
          stacktrace: {
            frames: [],
          },
        },
      ],
    },
    _meta: {
      exception: {
        values: {
          0: {
            value: {
              '': {
                len: 29,
                rem: [['device_id', 'p', 11, 51]],
              },
            },
          },
        },
      },
    },
    ...props,
  };
}

export {ExceptionWithMeta};
