import 'swagger-ui-react/swagger-ui.css';

import {OpenAPIV3} from 'openapi-types';
import SwaggerUI from 'swagger-ui-react';

import {EXPERIMENTAL_SPA} from 'sentry/constants';

type OpenApiDoc = OpenAPIV3.Document;
type ServerObject = OpenAPIV3.ServerObject;

const swagger: OpenApiDoc = require('../../../../tests/apidocs/openapi-derefed.json');

let servers: ServerObject[];

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
swagger.components = {};

const SwaggerUIDocs = () => <SwaggerUI spec={swagger} />;

export default SwaggerUIDocs;
