module.exports.AccountAppearance = function (params = {}) {
  return {
    stacktrace_order: '2',
    timezone: 'US/Pacific',
    language: 'en',
    clock_24_hours: true,
    ...params,
  };
};
