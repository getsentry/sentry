import 'swagger-ui-react/swagger-ui.css';

import SwaggerUI from 'swagger-ui-react';

import {EXPERIMENTAL_SPA} from 'sentry/constants';

const swagger = require('../../../../tests/apidocs/openapi-derefed.json');

let servers: {url: string}[];

const {hostname} = window.location;
const isLocalHost = hostname === 'localhost';
const isRunningOnDevUI = EXPERIMENTAL_SPA && isLocalHost;

if (isRunningOnDevUI) {
  servers = [{url: 'https://localhost:7999/'}];
} else if (isLocalHost) {
  servers = [{url: 'https://localhost:8000/'}];
} else {
  servers = [{url: 'https://sentry.io/'}];
}

swagger.servers = servers;

const SwaggerUIDocs = () => <SwaggerUI spec={swagger} />;

export default SwaggerUIDocs;
