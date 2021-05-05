import React from 'react';

import LogoSentry from 'app/components/logoSentry';

export default {
  title: 'Core/Style/Logo',
  component: LogoSentry,
};

export const Logo = () => (
  <div>
    <LogoSentry />
    <LogoSentry showWordmark={false} />
  </div>
);
