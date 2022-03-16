import * as React from 'react';

import DocumentationSetup from './documentationSetup';

type Props = React.ComponentProps<typeof DocumentationSetup>;

const Installation = (props: Props) => {
  // TODO: add logic for IntegrationSetup and OtherSetup
  return <DocumentationSetup {...props} />;
};

export default Installation;
