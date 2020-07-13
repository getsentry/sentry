function DataScrubbingRelayPiiConfig() {
  return {
    rules: {
      '0': {type: 'password', redaction: {method: 'replace', text: 'Scrubbed'}},
      '1': {type: 'creditcard', redaction: {method: 'mask'}},
      '2': {
        type: 'pattern',
        pattern: '[a-zA-Z0-9]+',
        redaction: {method: 'replace', text: 'Placeholder'},
      },
    },
    applications: {password: ['0'], $message: ['1', '2']},
  };
}

export {DataScrubbingRelayPiiConfig};
