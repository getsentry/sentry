export function EventEntryExceptionGroup() {
  return {
    type: 'exception',
    data: {
      values: [
        {
          type: 'ValueError',
          value: 'test',
          mechanism: {
            exception_id: 4,
            is_exception_group: false,
            parent_id: 3,
            source: 'exceptions[2]',
          },
          stacktrace: {
            frames: [
              {
                function: 'func4',
                module: 'helpers',
                filename: 'file4.py',
                absPath: 'file4.py',
                lineNo: 50,
                colNo: null,
                context: [[50, 'raise ValueError("test")']],
                inApp: true,
                data: {},
              },
            ],
          },
          rawStacktrace: null,
        },
        {
          type: 'ExceptionGroup 2',
          value: 'child',
          mechanism: {
            exception_id: 3,
            is_exception_group: true,
            parent_id: 1,
            source: 'exceptions[1]',
          },
          stacktrace: {
            frames: [
              {
                function: 'func3',
                module: 'helpers',
                filename: 'file3.py',
                absPath: 'file3.py',
                lineNo: 50,
                colNo: null,
                context: [],
                inApp: true,
                data: {},
              },
            ],
          },
          rawStacktrace: null,
        },
        {
          type: 'TypeError',
          value: 'nested',
          mechanism: {
            exception_id: 2,
            is_exception_group: false,
            parent_id: 1,
            source: 'exceptions[0]',
          },
          stacktrace: {
            frames: [
              {
                function: 'func2',
                module: 'helpers',
                filename: 'file2.py',
                absPath: 'file2.py',
                lineNo: 50,
                colNo: null,
                context: [[50, 'raise TypeError("int")']],
                inApp: true,
                data: {},
              },
            ],
          },
          rawStacktrace: null,
        },
        {
          type: 'ExceptionGroup 1',
          value: 'parent',
          mechanism: {
            exception_id: 1,
            is_exception_group: true,
            source: '__context__',
          },
          stacktrace: {
            frames: [
              {
                function: 'func1',
                module: 'helpers',
                filename: 'file1.py',
                absPath: 'file1.py',
                lineNo: 50,
                colNo: null,
                context: [[50, 'raise ExceptionGroup("parent")']],
                inApp: true,
                data: {},
              },
            ],
          },
          rawStacktrace: null,
        },
      ],
    },
  };
}
