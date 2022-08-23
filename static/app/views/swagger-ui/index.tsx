import 'swagger-ui-react/swagger-ui.css';

import swaggerUrl from 'sentry-swagger-ui/openapi.yml';
import SwaggerUI from 'swagger-ui-react';

const url = swaggerUrl;
const SwaggerUIDocs = () => <SwaggerUI url={url} />;

export default SwaggerUIDocs;
