import retryableImport from 'sentry/utils/retryableImport';

describe('retryableImport', () => {
  it('can dynamically import successfully on first try', async () => {
    const importMock = jest.fn();

    importMock.mockReturnValue(
      new Promise(resolve =>
        resolve({
          default: {
            foo: 'bar',
          },
        })
      )
    );

    const result = await retryableImport(importMock);

    expect(result).toEqual({
      default: {
        foo: 'bar',
      },
    });
    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry if error was not a webpack chunk loading error', async () => {
    const importMock = jest.fn();

    importMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => reject(new Error('Another error happened')))
    );

    try {
      await retryableImport(importMock);
    } catch (err) {
      // do nothing
    }
    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('can fail 2 dynamic imports and succeed on 3rd try', async () => {
    const importMock = jest.fn();

    importMock
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => reject(new Error('Loading chunk 123 failed')))
      )
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => reject(new Error('Loading chunk 123 failed')))
      )
      .mockReturnValue(
        new Promise(resolve =>
          resolve({
            default: {
              foo: 'bar',
            },
          })
        )
      );

    const result = await retryableImport(importMock);

    expect(result).toEqual({
      default: {
        foo: 'bar',
      },
    });
    expect(importMock).toHaveBeenCalledTimes(3);
  });

  it('only retries 3 times', async () => {
    const importMock = jest.fn(
      () =>
        new Promise<{default: unknown}>((_resolve, reject) =>
          reject(new Error('Loading chunk 123 failed'))
        )
    );

    await expect(retryableImport(importMock)).rejects.toThrow('Loading chunk 123 failed');
    expect(importMock).toHaveBeenCalledTimes(3);
  });

  it('retries on SyntaxError: Unexpected EOF from incomplete chunk', async () => {
    const importMock = jest.fn();
    const syntaxError = new SyntaxError('Unexpected EOF');

    importMock
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => reject(syntaxError))
      )
      .mockReturnValue(
        new Promise(resolve =>
          resolve({
            default: {
              foo: 'bar',
            },
          })
        )
      );

    const result = await retryableImport(importMock);

    expect(result).toEqual({
      default: {
        foo: 'bar',
      },
    });
    expect(importMock).toHaveBeenCalledTimes(2);
  });

  it('retries on SyntaxError: Unexpected end of script from incomplete chunk', async () => {
    const importMock = jest.fn();
    const syntaxError = new SyntaxError('Unexpected end of script');

    importMock
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => reject(syntaxError))
      )
      .mockReturnValue(
        new Promise(resolve =>
          resolve({
            default: {
              foo: 'bar',
            },
          })
        )
      );

    const result = await retryableImport(importMock);

    expect(result).toEqual({
      default: {
        foo: 'bar',
      },
    });
    expect(importMock).toHaveBeenCalledTimes(2);
  });

  it('retries on SyntaxError: Unexpected end of input from incomplete chunk', async () => {
    const importMock = jest.fn();
    const syntaxError = new SyntaxError('Unexpected end of input');

    importMock
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => reject(syntaxError))
      )
      .mockReturnValue(
        new Promise(resolve =>
          resolve({
            default: {
              foo: 'bar',
            },
          })
        )
      );

    const result = await retryableImport(importMock);

    expect(result).toEqual({
      default: {
        foo: 'bar',
      },
    });
    expect(importMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on other SyntaxErrors', async () => {
    const importMock = jest.fn();
    const syntaxError = new SyntaxError('Invalid or unexpected token');

    importMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => reject(syntaxError))
    );

    try {
      await retryableImport(importMock);
    } catch (err) {
      // do nothing
    }
    expect(importMock).toHaveBeenCalledTimes(1);
  });
});
