import React from 'react';

import Feature from 'app/components/acl/feature';

const IncidentRules: React.FC = ({children}) => (
  <Feature features={['incidents']} renderDisabled>
    {children}
  </Feature>
);

export default IncidentRules;
