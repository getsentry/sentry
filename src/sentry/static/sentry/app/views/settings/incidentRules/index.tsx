import React from 'react';

import Feature from 'app/components/acl/feature';

type Props = {
  children: React.ReactNode;
};

const IncidentRules = ({children}: Props) => (
  <Feature features={['incidents']} renderDisabled>
    {children}
  </Feature>
);

export default IncidentRules;
