import retryableImport from 'app/utils/retryableImport';

describe('retryableImport', function() {
  it('can dynamically import successfully on first try', async function() {
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

  it('can fail 2 dynamic imports and succeed on 3rd try', async function() {
    const importMock = jest.fn();

    importMock
      .mockReturnValueOnce(
        new Promise((resolve, reject) => reject(new Error('Unable to import')))
      )
      .mockReturnValueOnce(
        new Promise((resolve, reject) => reject(new Error('Unable to import')))
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

  it('only retries 3 times', async function() {
    const importMock = jest.fn(
      () => new Promise((resolve, reject) => reject('Unable to import'))
    );

    await expect(retryableImport(() => importMock())).rejects.toThrow('Unable to import');
    expect(importMock).toHaveBeenCalledTimes(3);
  });
});
