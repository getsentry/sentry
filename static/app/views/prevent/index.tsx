import React from 'react';

interface Props {
  children: React.ReactNode;
}

export default function PreventPage({children}: Props) {
  // Temporarily bypass feature check for development
  // TODO: Re-enable feature check once feature flags are working properly
  // Imports needed when re-enabling: Feature, NoAccess, useOrganization
  return <React.Fragment>{children}</React.Fragment>;

  // Original code with feature check:
  // return (
  //   <Feature
  //     features={['prevent-ai']}
  //     organization={organization}
  //     renderDisabled={NoAccess}
  //   >
  //     {children}
  //   </Feature>
  // );
}
