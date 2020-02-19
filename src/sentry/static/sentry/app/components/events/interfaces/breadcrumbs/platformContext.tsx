import React from 'react';

export const PlatformContext = React.createContext<{platform: string} | undefined>(
  undefined
);
