import 'swagger-ui-react/swagger-ui.css';

import SwaggerUI from 'swagger-ui-react';

const swagger = require('../../../../tests/apidocs/openapi-derefed.json');

const SwaggerUIDocs = () => <SwaggerUI spec={swagger} />;

export default SwaggerUIDocs;
