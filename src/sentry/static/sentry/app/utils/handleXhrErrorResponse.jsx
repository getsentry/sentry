import Raven from 'raven-js';

export default function handleXhrErrorResponse(message) {
  return resp => {
    if (!resp) return;
    if (!resp.responseJSON) return;

    let {responseJSON} = resp;

    // If this is a string then just capture it as error
    if (typeof responseJSON.detail === 'string') {
      Raven.captureException(new Error(message), {
        status: resp.status,
        detail: responseJSON.detail,
      });
      return;
    }

    // Ignore sudo-required errors
    if (responseJSON.detail.code === 'sudo-required') return;

    if (typeof responseJSON.detail.message === 'string') {
      Raven.captureException(new Error(message), {
        status: resp.status,
        detail: responseJSON.detail.message,
        code: responseJSON.detail.code,
      });
      return;
    }
  };
}
