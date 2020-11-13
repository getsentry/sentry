import retryableImport from 'app/utils/retryableImport';

describe('retryableImport', function () {
  it('can dynamically import successfully on first try', async function () {
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

    const result = await retryableImport(() => importMock());

    expect(result).toEqual({
      foo: 'bar',
    });
    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry if error was not a webpack chunk loading error', async function () {
    const importMock = jest.fn();

    importMock.mockReturnValueOnce(
      new Promise((_resolve, reject) => reject(new Error('Another error happened')))
    );

    try {
      await retryableImport(() => importMock());
    } catch (err) {
      // do nothing
    }
    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('can fail 2 dynamic imports and succeed on 3rd try', async function () {
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

    const result = await retryableImport(() => importMock());

    expect(result).toEqual({
      foo: 'bar',
    });
    expect(importMock).toHaveBeenCalledTimes(3);
  });

  it('only retries 3 times', async function () {
    const importMock = jest.fn(
      () =>
        new Promise((_resolve, reject) => reject(new Error('Loading chunk 123 failed')))
    );

    await expect(retryableImport(() => importMock())).rejects.toThrow(
      'Loading chunk 123 failed'
    );
    expect(importMock).toHaveBeenCalledTimes(3);
  });
});
