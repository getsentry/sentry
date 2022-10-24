const {CommitAuthor} = require('./commitAuthor');
const {Repository} = require('./repository');

module.exports.Commit = function (params = {}) {
  return {
    dateCreated: '2018-11-30T18:46:31Z',
    message:
      '(improve) Add Links to Spike-Protection Email (#2408)\n\n* (improve) Add Links to Spike-Protection Email\r\n\r\nUsers now have access to useful links from the blogs and docs on Spike-protection.\r\n\r\n* fixed wording',
    id: 'f7f395d14b2fe29a4e253bf1d3094d61e6ad4434',
    author: CommitAuthor(),
    repository: Repository(),
    ...params,
  };
};
