function DataScrubbingRelayPiiConfig() {
  return {
    rules: {
      '0': {type: 'password', redaction: {method: 'replace', text: 'Scrubbed'}},
      '1': {type: 'creditcard', redaction: {method: 'mask'}},
    },
    applications: {password: ['0'], $message: ['1']},
  };
}

export {DataScrubbingRelayPiiConfig};
