import queryString from 'query-string';

export const generateRequest = input => {
  const {params = {}, ...request} = input;

  const access_token = localStorage.getItem('stackexchange_access_token');

  if (access_token) {
    params.access_token = access_token;
    params.key = '6065CS6mUaSWL)Vv)Spfgg((';
  }

  request.url = `${request.url}?${queryString.stringify(params)}`;

  return request;
};
