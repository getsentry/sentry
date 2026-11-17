import {RuleTester} from 'oxlint/plugins-dev';

import {noRelativeApiUrl} from './noRelativeApiUrl';

const ruleTester = new RuleTester({
  languageOptions: {parserOptions: {lang: 'tsx'}},
});

ruleTester.run('no-relative-api-url', noRelativeApiUrl, {
  valid: [
    {code: "api.requestPromise('/organizations/acme/issues/');"},
    {code: "const url = resolveHostname('/api/0/organizations/acme/data-export/1/');"},
    {
      code: 'const url = resolveHostname(`/api/0/projects/${org}/${project}/files/dsyms/`);',
    },
    {code: 'const url = resolveHostname(`/api/0${path}?download`, host);'},
    {code: "const url = resolveHostname('/api/0' + path + '?download');"},
    {code: 'const url = resolveHostname(`${api.baseUrl}/projects/${org}/`);'},
    {
      code: 'const url = `${regionUrl}/api/0/projects/${org}/${project}/events/${id}/json/`;',
    },
    {code: "const url = 'https://sentry.io/api/0/organizations/acme/';"},
    {code: "const url = '/api/01/';"},
    {code: "const url = '/apis/0/';"},
    {code: "const path = 'organizations/acme/api/0/';"},
    {code: 'const url = `${prefix}/api/0${path}`;'},
    {code: "const url = host + '/api/0/organizations/' + slug;"},
    {code: 'const url = host + `/api/0/organizations/${slug}/`;'},
    {code: "const url = new URL(prefix + '/api/0' + path, host);"},
    {code: 'const url = `${regionHost}${api.baseUrl}/internal/project-config/`;'},
    {code: 'const url = regionHost + api.baseUrl + path;'},
    {code: 'const host = stepData.baseUrl;'},
    {code: 'const host = this.baseUrl;'},
    {code: "const host = api['baseUrl'];"},
  ],
  invalid: [
    {
      code: 'const url = encodeURI(`/api/0/projects/${org}/`);',
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: "const url = resolveHostname(host, '/api/0/projects/');",
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: "const url = '/api/0/organizations/acme/data-export/1/?download=true';",
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: "const baseUrl = '/api/0';",
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: "const url = '/api/0?query=1';",
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: "const url = '/api/0' + path;",
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: 'const url = `/api/0/organizations/${slug}/` + query;',
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: 'const url = `/api/0/projects/${org}/${project}/events/${id}/attachments/${attachmentId}/`;',
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: 'const url = `/api/0${getAttachmentUrl(props)}?download`;',
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: '<a href="/api/0/organizations/acme/data-export/1/?download=true" />;',
      errors: [{messageId: 'relativeApiUrl'}],
    },
    {
      code: 'const url = `${api.baseUrl}/projects/${org}/${project}/files/dsyms/?id=${id}`;',
      errors: [{messageId: 'apiBaseUrl'}],
    },
    {
      code: 'const url = api.baseUrl + path;',
      errors: [{messageId: 'apiBaseUrl'}],
    },
    {
      code: 'const baseUrl = api.baseUrl;',
      errors: [{messageId: 'apiBaseUrl'}],
    },
    {
      code: 'const url = this.props.api.baseUrl + path;',
      errors: [{messageId: 'apiBaseUrl'}],
    },
  ],
});
