import 'swagger-ui-react/swagger-ui.css';

import swaggerUrl from 'sentry-swagger-ui/openapi.yml';
import SwaggerUI from 'swagger-ui-react';

const SwaggerUIDocs = () => <SwaggerUI url={swaggerUrl} />;

export default SwaggerUIDocs;
