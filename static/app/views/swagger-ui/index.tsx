import {OpenAPIV3} from 'openapi-types';
import SwaggerUI from 'swagger-ui-react';

import SentryLayoutPlugin from 'sentry/components/swagger-ui/sentryLayoutPlugin';
import {EXPERIMENTAL_SPA} from 'sentry/constants';

import '../../../less/swagger-ui/main.less';

const swagger: OpenApiDoc = require('../../../../tests/apidocs/openapi-derefed.json');

type OpenApiDoc = OpenAPIV3.Document;

const {hostname} = window.location;
const isLocalHost = hostname === 'localhost';
const isRunningOnDevUI = EXPERIMENTAL_SPA && isLocalHost;

if (isRunningOnDevUI) {
  swagger.servers = [{url: 'https://localhost:7999/'}];
} else if (isLocalHost) {
  swagger.servers = [{url: 'https://localhost:8000/'}];
} else {
  swagger.servers = [{url: `https://${hostname}/`}];
}

const SwaggerUIDocs = () => (
  <SwaggerUI spec={swagger} plugins={[SentryLayoutPlugin]} layout="SentryLayout" />
);

export default SwaggerUIDocs;
