import handleError from 'sentry/views/settings/components/dataScrubbing/modals/handleError';

describe('Data Scrubbing handleError', function () {
  it.each([
    {
      message: 'Compiled regex exceeds size limit of 262144 bytes.',
      name: 'regex too long',
    },
  ])('recognizes errors "$name"', function ({message}) {
    const rawError = {
      responseJSON: {
        relayPiiConfig: [message],
      },
    };
    const error = handleError(rawError);
    // check we don't get the default error message
    expect(error.message.toLowerCase().startsWith('an unknown error')).toBeFalsy();
  });
});
